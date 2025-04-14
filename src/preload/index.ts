import { contextBridge, ipcRenderer } from "electron";

// レンダラープロセスで使用する安全なAPIを定義
contextBridge.exposeInMainWorld("electronAPI", {
	// ファイル選択ダイアログを開く
	openFile: () => ipcRenderer.invoke("dialog:openFile"),

	// LLMとの通信機能
	sendMessageToLLM: (message: string) =>
		ipcRenderer.invoke("llm:sendMessage", message),

	// 設定関連
	openSettingsDialog: () => ipcRenderer.send("open-settings-dialog"),
	setApiKey: (apiKey: string) => ipcRenderer.invoke("llm:setApiKey", apiKey),

	// イベントリスナー
	onApiKeyUpdate: (
		callback: (result: { success: boolean; message: string }) => void
	) => {
		ipcRenderer.on("api-key-update", (_event, result) => callback(result));
		return () => {
			ipcRenderer.removeAllListeners("api-key-update");
		};
	},
});
