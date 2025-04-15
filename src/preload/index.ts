import { contextBridge, ipcRenderer } from "electron";

// レンダラープロセスで使用する安全なAPIを定義
contextBridge.exposeInMainWorld("electronAPI", {
	// ファイル選択ダイアログを開く
	openFile: () => ipcRenderer.invoke("dialog:openFile"),

	// LLMとの通信機能
	sendMessageToLLM: async (message: string, agentId?: string) => {
		try {
			console.log(`Preload: メッセージ送信リクエスト: ${message}`);
			const response = await ipcRenderer.invoke(
				"llm:sendMessage",
				message,
				agentId
			);
			console.log(`Preload: メッセージ送信レスポンス受信: ${response}`);
			return response;
		} catch (error) {
			console.error(
				"Preload: メッセージ送信中にエラーが発生しました",
				error
			);
			throw error;
		}
	},

	// エージェント一覧を取得
	getAgents: async () => {
		try {
			console.log("Preload: エージェント一覧取得リクエスト");
			const agents = await ipcRenderer.invoke("llm:getAgents");
			console.log(
				`Preload: エージェント一覧取得結果: ${JSON.stringify(agents)}`
			);
			return agents;
		} catch (error) {
			console.error(
				"Preload: エージェント一覧取得中にエラーが発生しました",
				error
			);
			throw error;
		}
	},

	// エージェント選択
	selectAgent: async (agentId: string) => {
		try {
			console.log(`Preload: エージェント選択リクエスト: ${agentId}`);
			const result = await ipcRenderer.invoke("llm:selectAgent", agentId);
			console.log(
				`Preload: エージェント選択結果: ${JSON.stringify(result)}`
			);
			return result;
		} catch (error) {
			console.error(
				"Preload: エージェント選択中にエラーが発生しました",
				error
			);
			return {
				success: false,
				message: "エージェント選択中にエラーが発生しました",
			};
		}
	},

	// 選択中のエージェントを取得
	getSelectedAgent: async () => {
		try {
			console.log("Preload: 選択中のエージェント取得リクエスト");
			const agent = await ipcRenderer.invoke("llm:getSelectedAgent");
			console.log(`Preload: 選択中のエージェント: ${agent}`);
			return agent;
		} catch (error) {
			console.error(
				"Preload: 選択中のエージェント取得中にエラーが発生しました",
				error
			);
			return null;
		}
	},

	// モデル関連（下位互換性のため残す）
	getAvailableModels: async () => {
		try {
			console.log("Preload: 利用可能なモデル一覧取得リクエスト");
			const models = await ipcRenderer.invoke("llm:getAvailableModels");
			console.log(
				`Preload: 利用可能なモデル一覧: ${JSON.stringify(models)}`
			);
			return models;
		} catch (error) {
			console.error(
				"Preload: モデル一覧取得中にエラーが発生しました",
				error
			);
			throw error;
		}
	},
	selectModel: async (modelId: string) => {
		try {
			console.log(`Preload: モデル選択リクエスト: ${modelId}`);
			const result = await ipcRenderer.invoke("llm:selectModel", modelId);
			console.log(`Preload: モデル選択結果: ${JSON.stringify(result)}`);
			return result;
		} catch (error) {
			console.error("Preload: モデル選択中にエラーが発生しました", error);
			return {
				success: false,
				message: "モデル選択中にエラーが発生しました",
			};
		}
	},
	getSelectedModel: async () => {
		try {
			console.log("Preload: 選択中のモデル取得リクエスト");
			const model = await ipcRenderer.invoke("llm:getSelectedModel");
			console.log(`Preload: 選択中のモデル: ${model}`);
			return model;
		} catch (error) {
			console.error(
				"Preload: 選択中のモデル取得中にエラーが発生しました",
				error
			);
			return "gemini-2.0-flash-exp"; // デフォルトモデル
		}
	},
});
