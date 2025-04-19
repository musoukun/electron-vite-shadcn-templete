// Agentの型定義
export interface Agent {
	id: string;
	name: string;
	description?: string;
	instructions?: string;
	modelId?: string;
	avatar?: string;
}

// スレッドの型定義
export interface Thread {
	id: string;
	title: string;
	agentId?: string; // エージェントID（オプション）
	agentName?: string; // エージェント名（オプション）
	metadata?: any; // メタデータ（オプション）
	createdAt?: string;
	updatedAt?: string;
}

// メッセージの型定義
export interface ChatMessage {
	role: string;
	content: string;
	id?: string;
	createdAt?: string;
}

// 互換性のために Message 型も提供
export interface Message {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt: string;
}
