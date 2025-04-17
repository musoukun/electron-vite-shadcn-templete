export interface Message {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt: string;
}

export interface Thread {
	id: string;
	title: string;
	agentId: string;
	createdAt: string;
	updatedAt: string;
}

export interface Agent {
	id: string;
	name: string;
	description?: string;
	avatar?: string;
}
