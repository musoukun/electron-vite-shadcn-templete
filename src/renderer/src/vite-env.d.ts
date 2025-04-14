/// <reference types="vite/client" />

interface Window {
	electronAPI: {
		openFile: () => Promise<string | undefined>;
		sendMessageToLLM: (message: string) => Promise<string>;
		openSettingsDialog: () => void;
		setApiKey: (
			apiKey: string
		) => Promise<{ success: boolean; message: string }>;
		onApiKeyUpdate: (
			callback: (result: { success: boolean; message: string }) => void
		) => (() => void) | undefined;
	};
}
