import type { MetaFunction } from "@remix-run/node";
import GameGrid from "~/components/gamegrid/GameGrid";
import { useWebSocket } from "~/contexts/WebSocketContext";
import { useEffect } from "react";
import { useNavigate } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "ワールドトリガー閉鎖環境試験グリッド対戦ゲーム" },
    { name: "description", content: "Phaserで作成したグリッドフィールドデモ" },
  ];
};

export default function Index() {
  // WebSocketコンテキストを使用
  const { readyState } = useWebSocket();

  const navigate = useNavigate();

  // WebSocketの接続状態が変わったらマッチングページにリダイレクト
  useEffect(() => {
    if (readyState !== 1) {
      navigate("/matching", { replace: true });
    }
  }, [readyState, navigate]);
  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* ゲーム画面 */}
      <div className="w-full h-full">
        <GameGrid />
      </div>
    </div>
  );
}
