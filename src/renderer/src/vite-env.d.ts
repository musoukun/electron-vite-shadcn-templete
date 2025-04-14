/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    openFile: () => Promise<string | undefined>;
    sendMessageToLLM: (message: string) => Promise<string>;
  }
}
