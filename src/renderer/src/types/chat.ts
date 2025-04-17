// Agentの型定義
export interface Agent {
	id: string;
	name: string;
	description?: string;
	instructions?: string;
	modelId?: string;
}

// スレッドの型定義
export interface Thread {
	id: string;
	title: string;
	agentId?: string; // エージェントID（オプション）
	agentName?: string; // エージェント名（オプション）
	metadata?: any; // メタデータ（オプション）
}

// メッセージの型定義
export interface ChatMessage {
	role: string;
	content: string;
	id?: string;
	createdAt?: string;
}
