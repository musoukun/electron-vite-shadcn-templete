import { contextBridge, ipcRenderer } from "electron";

// レンダラープロセスで使用する安全なAPIを定義
contextBridge.exposeInMainWorld("electronAPI", {
	// ファイル選択ダイアログを開く
	openFile: () => ipcRenderer.invoke("dialog:openFile"),

	// LLMとの通信機能
	sendMessageToLLM: (message: string, agentId?: string) =>
		ipcRenderer.invoke("llm:sendMessage", message, agentId),
		
	// エージェント一覧を取得
	getAgents: () => ipcRenderer.invoke("llm:getAgents"),
	
	// モデル関連
	getAvailableModels: () => ipcRenderer.invoke("llm:getAvailableModels"),
	selectModel: (modelId: string) => 
		ipcRenderer.invoke("llm:selectModel", modelId),
	getSelectedModel: () => 
		ipcRenderer.invoke("llm:getSelectedModel"),
});
