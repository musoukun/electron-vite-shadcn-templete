// MastraAPI型定義
interface Agent {
	id: string;
	name: string;
	description?: string;
}

interface Thread {
	id: string;
	title: string;
	metadata?: Record<string, any>;
	createdAt: string;
	updatedAt: string;
}

interface Message {
	id?: string;
	role: string;
	content: string;
	createdAt?: string;
}

interface MessageResponse {
	response: string;
	threadId?: string;
}

interface MastraAPI {
	getAgents: () => Promise<Agent[]>;
	getAgentDetails: (agentId: string) => Promise<Agent>;
	sendMessageToAgent: (
		agentId: string,
		messages: Message[],
		threadId?: string,
		resourceId?: string
	) => Promise<MessageResponse>;
	streamMessageFromAgent: (
		agentId: string,
		messages: Message[],
		threadId?: string,
		onChunk?: (chunk: string) => void,
		resourceId?: string
	) => Promise<void>;
	createThread: (
		agentId: string,
		title?: string,
		resourceId?: string
	) => Promise<Thread>;
	getThreads: (agentId: string, resourceId?: string) => Promise<Thread[]>;
	getThreadMessages: (
		threadId: string,
		agentId: string,
		resourceId?: string
	) => Promise<Message[]>;
}

interface ElectronInfo {
	appVersion: string;
}

// グローバル型拡張
declare global {
	interface Window {
		mastraAPI: MastraAPI;
		electronInfo: ElectronInfo;
	}
}

export {};
