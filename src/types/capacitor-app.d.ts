declare module '@capacitor/app' {
  export const App: {
    getInfo(): Promise<{ name: string; id: string; build: string; version: string }>;
    getState(): Promise<{ isActive: boolean }>;
    addListener(event: string, callback: (...args: any[]) => void): Promise<{ remove: () => void }>;
    removeAllListeners(): Promise<void>;
    exitApp(): Promise<void>;
    minimizeApp(): Promise<void>;
  };
}
