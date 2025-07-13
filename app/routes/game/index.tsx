import type { MetaFunction } from "@remix-run/node";
import GameGrid from "~/components/gamegrid/GameGrid";
import { useWebSocket } from "~/contexts/WebSocketContext";
import { useEffect } from "react";
import { useNavigate } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "スーパーロボット大戦風グリッドフィールド" },
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
    <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-8">
        <header className="flex flex-col items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            スーパーロボット大戦風グリッドフィールド
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            マウスでグリッドをホバー・クリックしてみてください
          </p>
        </header>
        <div className="game-section">
          <GameGrid />
        </div>
        <div className="instructions bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md">
          <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
            操作方法
          </h2>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• マウスでグリッドをホバーするとセルがハイライト</li>
            <li>• クリックするとコンソールに座標が表示</li>
            <li>• 12x12のグリッドフィールド</li>
            <li>• 青いキャラクター：自分のユニット（下段）</li>
            <li>• 赤いキャラクター：相手のユニット（上段）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
