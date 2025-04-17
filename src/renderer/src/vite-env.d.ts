/// <reference types="vite/client" />

// electronとmastraのAPIを明示的に定義
interface ElectronAPI {
	openFile: () => Promise<string | undefined>;
	sendMessageToLLM: (message: string) => Promise<string>;
}

interface MastraAPI {
	getAgents: () => Promise<any[]>;
	getAgentDetails: (agentId: string) => Promise<any>;
	sendMessageToAgent: (
		agentId: string,
		messages: any[],
		threadId?: string,
		resourceId?: string
	) => Promise<any>;
	streamMessageFromAgent: (
		agentId: string,
		messages: any[],
		threadId?: string,
		onChunk?: (chunk: string) => void,
		resourceId?: string
	) => Promise<any>;
	createThread: (
		agentId: string,
		title?: string,
		resourceId?: string
	) => Promise<any>;
	getThreads: (agentId: string, resourceId?: string) => Promise<any[]>;
	getThreadMessages: (
		threadId: string,
		agentId: string,
		resourceId?: string
	) => Promise<any[]>;
	updateThreadTitle: (
		threadId: string,
		agentId: string,
		title: string,
		resourceId?: string
	) => Promise<any>;
}

interface Window {
	electronAPI: ElectronAPI;
	mastraAPI: MastraAPI;
}
