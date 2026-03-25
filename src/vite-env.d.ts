/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FAKE_CAMERA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
