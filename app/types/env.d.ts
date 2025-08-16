// app/types/env.d.ts（新規作成）
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_SERVER_URL: string;
  readonly VITE_API_BASE_URL: string;
  // 他の環境変数も定義
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}