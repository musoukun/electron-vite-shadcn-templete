/// <reference types="vite/client" />

// electronとmastraのAPIを明示的に定義
interface ElectronAPI {
	openFile: () => Promise<string | undefined>;
	sendMessageToLLM: (message: string) => Promise<string>;
}

interface Agent {
	id: string;
	name: string;
	description?: string;
	instructions?: string;
	modelId?: string;
}

interface Thread {
	id: string;
	title: string;
	agentId?: string;
	agentName?: string;
	metadata?: any;
}

interface ChatMessage {
	role: string;
	content: string;
	id?: string;
	createdAt?: string;
}

interface MastraAPI {
	getAgents: () => Promise<Agent[]>;
	getAgentDetails: (agentId: string) => Promise<Agent>;
	getThreads: (agentId: string, resourceId?: string) => Promise<Thread[]>;
	getAllThreads: (resourceId?: string) => Promise<Thread[]>;
	createThread: (
		agentId: string,
		title: string,
		resourceid?: string
	) => Promise<Thread>;
	getThreadMessages: (
		threadId: string,
		agentId: string,
		resourceId?: string
	) => Promise<ChatMessage[]>;
	updateThreadTitle: (
		threadId: string,
		agentId: string,
		title: string,
		resourceId?: string
	) => Promise<any>;
	streamMessageFromAgent: (
		agentId: string,
		messages: ChatMessage[],
		threadId?: string,
		onChunk?: (chunk: string) => void,
		resourceId?: string
	) => Promise<any>;
	sendMessageToAgent: (
		agentId: string,
		messages: ChatMessage[],
		threadId?: string,
		resourceId?: string
	) => Promise<any>;
	deleteThread: (
		threadId: string,
		agentId: string
	) => Promise<{ success: boolean }>;
}

interface Window {
	mastraAPI: MastraAPI;
	electronAPI: ElectronAPI;
}
