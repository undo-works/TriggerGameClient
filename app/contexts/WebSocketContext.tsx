import { useFetcher } from "@remix-run/react";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { TurnCompleteResult } from "~/components/gamegrid/types";
import { NegotiateError, NegotiateResponse } from "~/routes/api/negotiate";

/**
 * WebSocketで送信するアクションデータの型定義
 */
export interface ActionData {
  characterId: string;
  position: { col: number; row: number };
  mainAzimuth: number;
  subAzimuth: number;
  timestamp: string;
}

/**
 * WebSocketメッセージの型定義
 */
export interface WebSocketMessage {
  type:
    | "connected"
    | "matchmaking"
    | "matchmaking_result"
    | "cancel_matching"
    | "cancel_matching_result"
    | "opponent_cancelled_match"
    | "submit_actions"
    | "enemy_action_submitted"
    | "turn_result"
    | "game_state_update"
    | "match_waiting"
    | "match_found"
    | "player_assigned"
    | "error"
    | "system";
  playerId?: string;
  matchId?: string;
  actionHistory?: ActionData[];
  enemyActions?: ActionData[];
  enemyPlayerId?: string;
  opponentPlayerId?: string; // opponent_cancelled_match用
  turnNumber?: number;
  timestamp?: string;
  result?: TurnCompleteResult;
  /** マッチング開始時のキャラクター情報 */
  characters?: string[];
  gameState?: Record<string, unknown>;
  playerCount?: number;
  message?: string;
  status?: string; // for matchmaking_result status (waiting, matched, etc.)
  /** Web PubSub イベント名 */
  event?: string;
}

/**
 * WebSocketコンテキストの型定義
 */
interface WebSocketContextType {
  // WebSocket接続状態
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";

  // https://developer.mozilla.org/ja/docs/Web/API/WebSocket/readyState
  /**
   * 0: CONNECTING
   * 1: OPEN
   * 2: CLOSING
   * 3: CLOSED
   */
  readyState: WebSocket["readyState"];

  // メッセージ送信
  sendMessage: (message: WebSocketMessage) => void;

  // メッセージリスナー
  addMessageListener: (
    type: string,
    callback: (data: WebSocketMessage) => void
  ) => void;
  removeMessageListener: (
    type: string,
    callback: (data: WebSocketMessage) => void
  ) => void;

  // プレイヤー・マッチ情報
  playerId: string | null;
  matchId: string | null;
  setMatchId: (matchId: string | null) => void;

  // 接続制御
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

/**
 * WebSocketプロバイダーコンポーネント
 */
export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [readyState, setReadyState] = useState<number>(
    typeof window !== "undefined" ? WebSocket.CLOSED : 3
  );
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  // メッセージリスナーを管理
  const messageListeners = useRef<
    Map<string, Set<(data: WebSocketMessage) => void>>
  >(new Map());

  // 再接続用のタイマー
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  // プレイヤーIDの初期化
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedPlayerId = localStorage.getItem("playerId");
      if (storedPlayerId) {
        setPlayerId(storedPlayerId);
      }
    }
  }, []);

  /**
   * 環境判定関数
   */
  const isLocalEnvironment = (): boolean => {
    if (typeof window === "undefined") return false;

    const hostname = window.location.hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.includes("localhost")
    );
  };

  const negotiateFetcher = useFetcher<NegotiateResponse | NegotiateError>();

  /**
   * Web PubSub 認証API呼び出し（Remix Action経由）
   */
  const getWebPubSubUrl = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Action を呼び出し
      negotiateFetcher.submit(
        {
          userId: playerId || "anonymous",
          roles: JSON.stringify([
            "webpubsub.sendToGroup",
            "webpubsub.joinLeaveGroup",
          ]),
        },
        {
          method: "POST",
          action: "/api/negotiate",
          encType: "application/json",
        }
      );

      // レスポンスを監視
      const checkResponse = () => {
        if (negotiateFetcher.state === "idle" && negotiateFetcher.data) {
          const data = negotiateFetcher.data;

          if ("error" in data) {
            console.error("Web PubSub 認証エラー:", data.error);
            reject(new Error(data.error));
          } else {
            console.log("Web PubSub 認証成功:", data.url);
            // ユーザーIDも更新
            if (data.userId && data.userId !== playerId) {
              setPlayerId(data.userId);
              if (typeof window !== "undefined") {
                localStorage.setItem("playerId", data.userId);
              }
            }
            resolve(data.url);
          }
        } else if (negotiateFetcher.state === "idle") {
          reject(new Error("No response from negotiate API"));
        } else {
          // まだ loading 中の場合は再チェック
          setTimeout(checkResponse, 100);
        }
      };

      checkResponse();
    });
  };

  /**
   * WebSocket URL を取得
   */
  const getWebSocketUrl = async (): Promise<string> => {
    // ローカル環境の場合
    // TODO: 不要なら削除する
    // if (isLocalEnvironment()) {
    //   return "ws://localhost:8080/";
    // }

    // 本番環境の場合：Web PubSub を使用
    try {
      return await getWebPubSubUrl();
    } catch (error) {
      console.error("Web PubSub URL取得失敗、フォールバックURLを使用:", error);

      // フォールバック：従来の方式
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.hostname}:8080/`;
    }
  };

  // WebSocket接続関数
  const connect = async () => {
    // サーバーサイドでは何もしない
    if (typeof window === "undefined") {
      console.log("サーバー環境のため WebSocket 接続をスキップします");
      return;
    }

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log("WebSocket is already connected");
      return;
    }

    try {
      setConnectionStatus("connecting");
      setReadyState(WebSocket.CONNECTING);

      // 環境に応じてWebSocket URLを取得
      const wsUrl = await getWebSocketUrl();
      console.log("WebSocket接続先:", wsUrl);

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket接続が確立されました");
        setConnectionStatus("connected");
        setReconnectAttempts(0);

        // Web PubSub の場合は初期化メッセージを送信
        if (!isLocalEnvironment()) {
          // Web PubSub グループに参加
          const joinMessage = {
            type: "joinGroup",
            group: "game-lobby",
            userId: playerId || "anonymous",
          };

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(joinMessage));
          }
        }

        // 実際のWebSocketの状態が確実にOPENになるまで待つ
        const checkReadyState = () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            console.log(
              "WebSocket readyState確認完了:",
              wsRef.current.readyState
            );
            setReadyState(WebSocket.OPEN);
          } else {
            console.log(
              "WebSocket readyState待機中:",
              wsRef.current?.readyState
            );
            setTimeout(checkReadyState, 10); // 10ms後に再チェック
          }
        };
        checkReadyState();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          console.log("WebSocketメッセージ受信:", data);

          // Web PubSub の場合のメッセージ処理
          if (!isLocalEnvironment()) {
            // Web PubSub からのメッセージは少し異なる形式の可能性があるため変換
            if (data.type === "system" && data.event === "connected") {
              data.type = "connected";
            }
          }

          // コネクションが成立
          if (data.type === "connected") {
            setConnectionStatus("connected");
            setReconnectAttempts(0);
          }

          // プレイヤーIDが発行された場合は保存
          if (data.type === "matchmaking_result" && data.playerId) {
            setPlayerId(data.playerId);
            if (typeof window !== "undefined") {
              localStorage.setItem("playerId", data.playerId);
            }
          }

          // マッチIDが含まれている場合は保存
          if (data.matchId) {
            setMatchId(data.matchId);
          }

          // リスナーに通知
          const listeners = messageListeners.current.get(data.type);
          if (listeners) {
            listeners.forEach((callback) => callback(data));
          }

          // 全メッセージリスナーにも通知
          const allListeners = messageListeners.current.get("*");
          if (allListeners) {
            allListeners.forEach((callback) => callback(data));
          }
        } catch (error) {
          console.error("WebSocketメッセージの解析に失敗:", error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocketエラー:", error);
        setConnectionStatus("error");
        setReadyState(WebSocket.CLOSED);
      };

      wsRef.current.onclose = (event) => {
        console.log("WebSocket接続が閉じられました:", event.code, event.reason);
        setReadyState(WebSocket.CLOSED);

        // 意図的でない切断の場合は再接続を試行
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          setConnectionStatus("connecting");
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, delay);
        } else {
          setConnectionStatus("disconnected");
        }
      };
    } catch (error) {
      console.error("WebSocket接続エラー:", error);
      setConnectionStatus("error");
      setReadyState(WebSocket.CLOSED);
    }
  };

  // WebSocket切断関数
  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, "Manual disconnect");
    }

    setConnectionStatus("disconnected");
    setReadyState(WebSocket.CLOSED);
  };

  // メッセージ送信関数
  const sendMessage = (message: WebSocketMessage) => {
    // サーバーサイドでは何もしない
    if (typeof window === "undefined") {
      console.warn(
        "サーバー環境のため WebSocket メッセージ送信をスキップします"
      );
      return;
    }
    console.log("WebSocket接続状態(state):", readyState);
    console.log("WebSocket接続状態(ref):", wsRef.current?.readyState);

    // 実際のWebSocketの状態もチェック
    if (
      wsRef.current &&
      readyState === WebSocket.OPEN &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      // プレイヤーIDとマッチIDを自動的に追加
      const messageWithIds = isLocalEnvironment()
        ? {
            ...message,
            playerId: message.playerId || playerId,
            matchId: message.matchId || matchId,
          }
        : {
            // Web PubSub の場合はメッセージ形式を調整
            type: "sendToGroup",
            group: "game-lobby",
            dataType: "json",
            data: {
              ...message,
              playerId: message.playerId || playerId,
              matchId: message.matchId || matchId,
            },
          };

      console.log("WebSocketメッセージ送信:", messageWithIds);
      wsRef.current.send(JSON.stringify(messageWithIds));
    } else {
      console.error(
        `WebSocketが接続されていません - メッセージ: ${JSON.stringify(
          message
        )} | 接続状態:  ${connectionStatus} | readyState(state): ${readyState} | readyState(ref): ${
          wsRef.current?.readyState
        } |`
      ); // エラーメッセージに両方の状態を追加
    }
  };

  // メッセージリスナー追加
  const addMessageListener = (
    type: string,
    callback: (data: WebSocketMessage) => void
  ) => {
    if (!messageListeners.current.has(type)) {
      messageListeners.current.set(type, new Set());
    }
    messageListeners.current.get(type)!.add(callback);
  };

  // メッセージリスナー削除
  const removeMessageListener = (
    type: string,
    callback: (data: WebSocketMessage) => void
  ) => {
    const listeners = messageListeners.current.get(type);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        messageListeners.current.delete(type);
      }
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const contextValue: WebSocketContextType = {
    connectionStatus,
    readyState,
    sendMessage,
    addMessageListener,
    removeMessageListener,
    playerId,
    matchId,
    setMatchId,
    connect,
    disconnect,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * WebSocketコンテキストを使用するためのフック
 */
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

export default WebSocketProvider;
