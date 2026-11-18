/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface MintzyDesktopApi {
  system?: {
    getTheme?: () => Promise<'system' | 'light' | 'dark'>;
    setTheme?: (theme: 'system' | 'light' | 'dark') => Promise<{ success: boolean }>;
    showNotification?: (title: string, body: string) => void;
  };
  auth?: {
    login?: (apiKey: string) => Promise<unknown>;
    logout?: () => Promise<unknown>;
    check?: () => Promise<unknown>;
  };
}

interface Window {
  mintzy?: MintzyDesktopApi;
}
