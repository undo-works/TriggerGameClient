import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "スーパーロボット大戦風グリッドフィールド" },
    { name: "description", content: "Phaserで作成したグリッドフィールドデモ" },
  ];
};

export default function Index() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* 六角形タイル背景 */}
      <div
        className="absolute inset-0 opacity-100"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='312' viewBox='0 0 360 312'%3E%3Cdefs%3E%3Cpattern id='hex' width='60' height='52' patternUnits='userSpaceOnUse'%3E%3Cpolygon points='30,2 58,17 58,47 30,62 2,47 2,17' fill='%23000000' stroke='%23ffffff' stroke-width='1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23hex)'/%3E%3C!-- 白いタイル ---%3E%3Cpolygon points='90,19 118,34 118,64 90,79 62,64 62,34' fill='%23ffffff' stroke='%23ffffff' stroke-width='1'/%3E%3Cpolygon points='210,71 238,86 238,116 210,131 182,116 182,86' fill='%23ffffff' stroke='%23ffffff' stroke-width='1'/%3E%3Cpolygon points='150,123 178,138 178,168 150,183 122,168 122,138' fill='%23ffffff' stroke='%23ffffff' stroke-width='1'/%3E%3Cpolygon points='270,175 298,190 298,220 270,235 242,220 242,190' fill='%23ffffff' stroke='%23ffffff' stroke-width='1'/%3E%3Cpolygon points='330,227 358,242 358,272 330,287 302,272 302,242' fill='%23ffffff' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "360px 312px",
          backgroundPosition: "0 0",
        }}
      />

      {/* グラデーションオーバーレイ */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/30 via-transparent to-gray-900/30" />

      {/* メインコンテンツ */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        {/* ヘッダー */}
        <header className="text-center mb-16">
          <div className="mb-6">
            <div className="inline-block p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-xl mb-4">
              <span className="text-4xl">🤖</span>
            </div>
          </div>
          <h1 className="text-6xl font-light text-white mb-4 tracking-tight">
            <span className="font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Trigger
            </span>
            <span className="text-gray-200">App</span>
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
            次世代のリアルタイム戦略シミュレーションゲーム
            <br />
            スーパーロボット大戦風グリッドフィールド対戦
          </p>

          {/* マッチング画面へのリンク */}
          <Link
            to="/matching"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 px-10 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl"
          >
            <span className="text-xl">🎮</span>
            <span>マッチング開始</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </header>

        {/* ゲーム機能紹介 */}
        <div className="max-w-6xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-light text-white mb-4">
              <span className="font-bold">主要機能</span>
            </h2>
            <div className="w-20 h-1 bg-gradient-to-r from-blue-400 to-indigo-400 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* リアルタイム対戦 */}
            <div className="group bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                リアルタイム対戦
              </h3>
              <p className="text-gray-300 leading-relaxed">
                WebSocketを使用したリアルタイム通信により、他のプレイヤーとのスムーズな対戦が可能です。
              </p>
            </div>

            {/* 戦略的グリッドバトル */}
            <div className="group bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                戦略的グリッドバトル
              </h3>
              <p className="text-gray-300 leading-relaxed">
                36x36の六角形グリッドフィールドで、キャラクターの配置と射撃方向を戦略的に決定できます。
              </p>
            </div>

            {/* キャラクター操作 */}
            <div className="group bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                キャラクター操作
              </h3>
              <p className="text-gray-300 leading-relaxed">
                4体のキャラクターを操作し、移動・メイン射撃・サブ射撃の方向を設定して戦略を組み立てます。
              </p>
            </div>

            {/* 行動力システム */}
            <div className="group bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                行動力システム
              </h3>
              <p className="text-gray-300 leading-relaxed">
                各キャラクターは行動力を持ち、移動や射撃設定で消費します。戦略的な行動力管理が勝利の鍵です。
              </p>
            </div>

            {/* 自動マッチング */}
            <div className="group bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🔄</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                自動マッチング
              </h3>
              <p className="text-gray-300 leading-relaxed">
                WebSocketサーバーが自動で対戦相手を見つけてマッチングを行います。待機時間を最小限に抑えます。
              </p>
            </div>

            {/* Phaserエンジン */}
            <div className="group bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🎮</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                Phaserエンジン
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Phaser.jsを使用したスムーズなゲーム体験。直感的な操作とリアルタイムレンダリングを実現します。
              </p>
            </div>
          </div>
        </div>

        {/* 操作説明 */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="bg-white/10 backdrop-blur-sm p-10 rounded-3xl shadow-xl border border-white/20">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-light text-white mb-4">
                <span className="font-bold">操作方法</span>
              </h3>
              <div className="w-16 h-1 bg-gradient-to-r from-blue-400 to-indigo-400 mx-auto rounded-full"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">基本操作</h4>
                    <ul className="text-gray-300 space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        クリック: キャラクター選択
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        移動: 移動可能範囲をクリック
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        射撃設定: 方向をドラッグで設定
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        行動完了: 全キャラクターの行動力消費
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">
                      戦略のコツ
                    </h4>
                    <ul className="text-gray-300 space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                        射撃範囲を意識した配置
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                        行動力の効率的な使用
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                        敵の行動を予測した位置取り
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                        メイン・サブ射撃の使い分け
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <footer className="text-center">
          <div className="inline-flex items-center gap-2 text-gray-400 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20">
            <span className="text-sm">Powered by</span>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-blue-400">Remix</span>
              <span className="text-gray-500">+</span>
              <span className="font-semibold text-indigo-400">Phaser.js</span>
              <span className="text-gray-500">+</span>
              <span className="font-semibold text-purple-400">WebSocket</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
