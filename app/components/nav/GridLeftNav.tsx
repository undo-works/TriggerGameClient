import { useState } from "react";
import { ActionHistory } from "~/entities/ActionHistoryEntity";
import ActionHistoryPanel from "../panels/ActionHistoryPanel";
import "./index.css";

interface NavItem {
  idx: number;
  id: string;
  icon: string | React.ReactNode;
  label: string;
  content?: React.ReactNode;
  action?: () => void;
  disabled?: boolean;
}

interface GridLeftNavProps {
  isGameActive?: boolean;
  gameStatus?: {
    turn: number;
    phase: string;
    playersConnected: number;
  };
  customItems?: NavItem[];
  actionHistories?: ActionHistory[];
  onItemClick?: (itemId: string) => void;
}

export default function GridLeftNav({
  customItems,
  actionHistories = [],
  onItemClick,
}: GridLeftNavProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  /** ナビゲーション項目 */
  const navigationItems: NavItem[] = [
    {
      idx: 0,
      id: "actionHistories",
      icon: (
        <img src="/icons/footprint.svg" alt="History" className="w-6 h-6" />
      ),
      label: "行動設定",
      content:
        actionHistories.length > 0 ? (
          <ActionHistoryPanel globalActionHistory={actionHistories} />
        ) : (
          <div className="text-white p-2">
            キャラクターを選択して行動を開始してください
          </div>
        ),
    },
    {
      idx: 1,
      id: "help",
      icon: (
        <img
          src="/icons/backhand.svg"
          alt="History"
          className="w-6 h-6 text-sky-500"
        />
      ),
      label: "操作方法",
      content: (
        <div className="text-white p-2">
          <div className="space-y-1">
            <div>• 左クリック: キャラクター選択・移動</div>
            <div>• 左クリック + ドラッグ: 画面移動</div>
            <div>• マウスホイール: ズーム切り替え</div>
            <div>• 対戦終了: 現在の対戦を強制終了してサイトホームに戻ります</div>
          </div>
        </div>
      ),
    },
  ];

  const navItems = customItems || navigationItems;

  const handleItemClick = (item: NavItem) => {
    if (item.disabled) return;

    // クリックされた項目の展開状態をトグル
    setSelectedIndex((prev) => (prev === item.idx ? null : item.idx));
    console.log("selected index:", selectedIndex);

    if (item.action) {
      item.action();
    }

    if (onItemClick) {
      onItemClick(item.id);
    }
  };

  return (
    <div
      className={`fixed left-0 top-0 z-40 h-full grid ${
        selectedIndex !== null ? "w-72  grid-cols-6" : "w-12  grid-cols-1"
      }`}
    >
      {/* メインナビゲーションバー */}
      <div className="h-full bg-slate-900/50 backdrop-blur-sm border-gray-700 shadow-2xl overflow-hidden col-span-1">
        {/* ナビゲーション項目 */}
        <div className="py-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              className={`w-full flex items-center text-white transition-all duration-200 relative justify-center ${
                item.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-white/10 active:bg-white/20"
              }`}
              title={selectedIndex !== item.idx ? item.label : undefined}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all duration-200 relative`}
              >
                {typeof item.icon === "string" ? item.icon : item.icon}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 右側コンテンツエリア */}
      {selectedIndex !== null && (
        <div
          className="h-screen bg-slate-900/50 backdrop-blur-sm border-r border-gray-700 shadow-xl transition-all duration-300 ease-in-out col-span-5"
          style={{ animation: "slideInFromLeft 0.8s ease-out" }}
        >
          {/* ヘッダー */}
          <div className="h-12 p-3 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center">
              <span className="text-xl mr-2">
                {typeof navigationItems[selectedIndex].icon === "string"
                  ? navigationItems[selectedIndex].icon
                  : navigationItems[selectedIndex].icon}
              </span>
              {navigationItems[selectedIndex].label}
            </h3>
            <button
              onClick={() => setSelectedIndex(null)}
              className="text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* コンテンツエリア */}
          <div className="h-full overflow-y-scroll" style={{ maxHeight: `calc(100% - 48px)` }}>
            {navigationItems[selectedIndex].content || (
              <div className="p-4 text-gray-300">
                {navigationItems[selectedIndex].label}
                の内容がここに表示されます。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
