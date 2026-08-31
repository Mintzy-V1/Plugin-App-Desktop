/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface MintzyDesktopApi {
  auth?: {
    login?: (apiKey: string) => Promise<unknown>;
    logout?: () => Promise<unknown>;
    check?: () => Promise<unknown>;
  };
}

interface Window {
  mintzy?: MintzyDesktopApi;
}
