import { useState, useEffect } from 'react';
import type { MetaFunction } from '@remix-run/node';
import { useNavigate } from '@remix-run/react';
import { useWebSocket, type WebSocketMessage } from '../../contexts/WebSocketContext';

export const meta: MetaFunction = () => {
  return [
    { title: 'Matching - TriggerApp' },
    { name: 'description', content: 'Find and match with other players' },
  ];
};

interface MatchingStatus {
  status: 'connecting' | 'waiting' | 'matched' | 'error';
  matchId?: string;
  playerId?: string;
  playerCount?: number;
  message?: string;
}

export default function MatchingPage() {
  const navigate = useNavigate();
  const [matchingStatus, setMatchingStatus] = useState<MatchingStatus>({
    status: 'connecting'
  });
  
  const {
    readyState,
    sendMessage,
    addMessageListener,
    removeMessageListener,
    playerId,
    matchId,
    connect,
  } = useWebSocket();

  // WebSocketメッセージハンドラー
  useEffect(() => {
    // 接続状態に応じてマッチング状態を更新
    if (readyState === WebSocket.CONNECTING) {
      setMatchingStatus({
        status: "connecting",
        message: "サーバーに接続中...",
      });
    }
  }, [readyState]);

  // プレイヤーIDと状態をコンテキストから取得
  useEffect(() => {
    if (playerId) {
      setMatchingStatus((prev) => ({
        ...prev,
        playerId: playerId,
      }));
    }
    if (matchId) {
      setMatchingStatus((prev) => ({
        ...prev,
        matchId: matchId,
      }));
    }
  }, [playerId, matchId]);

  // メッセージリスナーの設定
  useEffect(() => {
    const handlePlayerAssigned = (data: WebSocketMessage) => {
      setMatchingStatus((prev) => ({
        ...prev,
        playerId: data.playerId,
      }));
    };

    const handleMatchWaiting = (data: WebSocketMessage) => {
      setMatchingStatus({
        status: "waiting",
        matchId: data.matchId,
        playerId: data.playerId,
        playerCount: data.playerCount || 1,
        message: "マッチング相手を探しています...",
      });
    };

    const handleMatchingResult = (data: WebSocketMessage) => {
      if (data.status === "matched") {
        setMatchingStatus({
          status: "matched",
          matchId: data.matchId,
          playerId: data.playerId,
          playerCount: 2,
          message: "マッチが成立しました！ゲームを開始します...",
        });

        // 3秒後にゲーム画面に遷移
        setTimeout(() => {
          navigate("/game");
        }, 3000);
      } else if (data.status === "waiting") {
        setMatchingStatus({
          status: "waiting",
          matchId: data.matchId,
          playerId: data.playerId,
          playerCount: data.playerCount || 1,
          message: "マッチング相手を探しています...",
        });
      }
    };

    const handleError = (data: WebSocketMessage) => {
      setMatchingStatus({
        status: "error",
        message: data.message || "エラーが発生しました",
      });
    };

    // リスナーを追加
    addMessageListener("player_assigned", handlePlayerAssigned);
    addMessageListener("matchmaking", handleMatchWaiting);
    addMessageListener("matchmaking_result", handleMatchingResult);
    addMessageListener("error", handleError);

    return () => {
      // クリーンアップ
      removeMessageListener("player_assigned", handlePlayerAssigned);
      removeMessageListener("matchmaking", handleMatchWaiting);
      removeMessageListener("matchmaking_result", handleMatchingResult);
      removeMessageListener("error", handleError);
    };
  }, [addMessageListener, removeMessageListener, navigate]);

  // マッチング開始
  useEffect(() => {
    console.log("マッチング開始のチェック:", readyState);
    if (readyState === WebSocket.OPEN) {
      // マッチング開始メッセージを送信
      sendMessage({
        type: "matchmaking",
      });
      console.log("マッチング開始メッセージを送信しました");
    } else {
      // 接続していない場合は接続を開始
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyState]); // readyStateの変更時のみ実行

  // マッチングキャンセル
  const cancelMatching = () => {
    sendMessage({
      type: "cancel_matching",
      playerId: playerId || undefined,
    });
    navigate("/");
  };

  // 再接続ボタン
  const retryConnection = () => {
    connect();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center border border-white/20">
        {/* ヘッダー */}
        <h1 className="text-3xl font-bold text-white mb-8">マッチング</h1>

        {/* ステータス表示 */}
        <div className="mb-8">
          {matchingStatus.status === "connecting" && (
            <div className="text-white">
              <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mx-auto mb-4"></div>
              <p className="text-lg">
                {matchingStatus.message || "サーバーに接続中..."}
              </p>
            </div>
          )}

          {matchingStatus.status === "waiting" && (
            <div className="text-white">
              <div className="animate-pulse w-16 h-16 bg-yellow-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-lg mb-2">{matchingStatus.message}</p>
              <p className="text-sm text-white/70">
                プレイヤー数: {matchingStatus.playerCount}/2
              </p>
              {matchingStatus.playerId && (
                <p className="text-xs text-white/50 mt-2">
                  Player ID: {matchingStatus.playerId}
                </p>
              )}
            </div>
          )}

          {matchingStatus.status === "matched" && (
            <div className="text-white">
              <div className="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-lg text-green-300">{matchingStatus.message}</p>
              <div className="animate-pulse text-sm text-white/70 mt-2">
                ゲーム画面に移動中...
              </div>
            </div>
          )}

          {matchingStatus.status === "error" && (
            <div className="text-white">
              <div className="w-16 h-16 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <p className="text-lg text-red-300 mb-4">
                {matchingStatus.message}
              </p>
              <button
                onClick={retryConnection}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                再接続
              </button>
            </div>
          )}
        </div>

        {/* マッチ情報 */}
        {matchingStatus.matchId && (
          <div className="bg-white/5 rounded-lg p-4 mb-6 text-white/70">
            <p className="text-sm">
              マッチID:{" "}
              <span className="font-mono">{matchingStatus.matchId}</span>
            </p>
          </div>
        )}

        {/* アクションボタン */}
        <div className="space-y-3">
          {(matchingStatus.status === "waiting" ||
            matchingStatus.status === "connecting") && (
            <button
              onClick={cancelMatching}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg transition-colors"
            >
              マッチングをキャンセル
            </button>
          )}

          <button
            onClick={() => navigate("/")}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg transition-colors"
            disabled={matchingStatus.status === "matched"}
          >
            ホームに戻る
          </button>
        </div>

        {/* デバッグ情報（開発時のみ） */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 text-left bg-black/20 rounded-lg p-3 text-xs text-white/50 font-mono">
            <p>Status: {matchingStatus.status}</p>
            <p>Player ID: {matchingStatus.playerId || "None"}</p>
            <p>Match ID: {matchingStatus.matchId || "None"}</p>
            <p>Ready State: {readyState}</p>
            <p>Is Connected: {readyState === WebSocket.OPEN ? "Yes" : "No"}</p>
          </div>
        )}
      </div>
    </div>
  );
}