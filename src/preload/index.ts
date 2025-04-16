import { contextBridge, ipcRenderer } from "electron";

// APIのベースURL
const API_BASE_URL = "http://localhost:4111"; // デフォルトは8000ポートを想定

// レンダラープロセスで使用する安全なAPIを定義
contextBridge.exposeInMainWorld("electronAPI", {
	// ファイル選択ダイアログを開く
	openFile: () => ipcRenderer.invoke("dialog:openFile"),

	// LLMとの通信機能 (将来実装)
	sendMessageToLLM: (message: string) => {
		// LLMとの通信ロジックを実装予定
		console.log(`Message to LLM: ${message}`);
		return Promise.resolve("LLMからの応答がここに表示されます");
	},
});

// Mastra APIとの通信機能を定義
contextBridge.exposeInMainWorld("mastraAPI", {
	// 利用可能なAgentの一覧を取得
	getAgents: async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/api/agents`);
			if (!response.ok) {
				throw new Error(`APIエラー: ${response.status}`);
			}
			return await response.json();
		} catch (error) {
			console.error("Agentの取得に失敗しました:", error);
			throw error;
		}
	},

	// AgentのIDからAgent詳細を取得
	getAgentDetails: async (agentId: string) => {
		try {
			const response = await fetch(
				`${API_BASE_URL}/api/agents/${agentId}`
			);
			if (!response.ok) {
				throw new Error(`APIエラー: ${response.status}`);
			}
			return await response.json();
		} catch (error) {
			console.error("Agent詳細の取得に失敗しました:", error);
			throw error;
		}
	},

	// Agentにメッセージを送信して返答をストリーミングで取得
	streamMessageFromAgent: async (
		agentId: string,
		messages: any[],
		threadId?: string,
		onChunk?: (chunk: string) => void
	) => {
		try {
			const response = await fetch(
				`${API_BASE_URL}/api/agents/${agentId}/stream`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						messages,
						threadId: threadId || undefined,
					}),
				}
			);

			if (!response.ok) {
				throw new Error(`APIエラー: ${response.status}`);
			}

			// ストリームレスポンスの読み取り
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();
			let fullText = "";

			if (reader) {
				while (true) {
					const { value, done } = await reader.read();

					if (done) {
						break;
					}

					// バイナリデータをテキストに変換
					const text = decoder.decode(value, { stream: true });
					fullText += text;

					// 各チャンクごとにコールバック関数を呼び出し
					if (onChunk) {
						onChunk(text);
					}
				}
			}

			return { text: fullText };
		} catch (error) {
			console.error("メッセージのストリーミングに失敗しました:", error);
			throw error;
		}
	},

	// 従来の一括レスポンス方式のメッセージ送信（フォールバック用）
	sendMessageToAgent: async (
		agentId: string,
		messages: any[],
		threadId?: string
	) => {
		try {
			const response = await fetch(
				`${API_BASE_URL}/api/agents/${agentId}/generate`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						messages,
						threadId: threadId || undefined,
					}),
				}
			);

			if (!response.ok) {
				throw new Error(`APIエラー: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("メッセージの送信に失敗しました:", error);
			throw error;
		}
	},

	// 新しいスレッドを作成
	createThread: async (agentId: string, title = "新しい会話") => {
		try {
			const response = await fetch(
				`${API_BASE_URL}/api/memory/threads?agentId=${agentId}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						title,
					}),
				}
			);

			if (!response.ok) {
				throw new Error(`APIエラー: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("スレッドの作成に失敗しました:", error);
			throw error;
		}
	},

	// スレッド一覧を取得
	getThreads: async (agentId: string, resourceId?: string) => {
		try {
			const url = new URL(`${API_BASE_URL}/api/memory/threads`);
			url.searchParams.append("agentId", agentId);
			if (resourceId) {
				url.searchParams.append("resourceid", resourceId);
			}

			const response = await fetch(url.toString());
			if (!response.ok) {
				throw new Error(`APIエラー: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("スレッド一覧の取得に失敗しました:", error);
			throw error;
		}
	},

	// スレッドのメッセージを取得
	getThreadMessages: async (threadId: string, agentId: string) => {
		try {
			const response = await fetch(
				`${API_BASE_URL}/api/memory/threads/${threadId}/messages?agentId=${agentId}`
			);

			if (!response.ok) {
				throw new Error(`APIエラー: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("スレッドメッセージの取得に失敗しました:", error);
			throw error;
		}
	},
});
