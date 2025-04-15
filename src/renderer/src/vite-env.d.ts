/// <reference types="vite/client" />

interface Window {
	electronAPI: {
		openFile: () => Promise<string | undefined>;
		sendMessageToLLM: (message: string, agentId?: string) => Promise<string>;
		getAgents: () => Promise<any[]>;
		getAvailableModels: () => Promise<{ id: string; name: string }[]>;
		selectModel: (modelId: string) => Promise<{ success: boolean; message: string }>;
		getSelectedModel: () => Promise<string>;
	};
}
