import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import axios from "axios";
// @ts-ignore - client-jsの型定義がない場合、エラーを無視
import { MastraClient } from "@mastra/client-js";
// APIのベースURL
const API_BASE_URL = "http://localhost:4111";

// MastraClientの初期化
const mastraClient = new MastraClient({
	baseUrl: API_BASE_URL,
});

// アプリのウィンドウを格納するグローバル参照
// これをしないとGCされてしまいます
let mainWindow: BrowserWindow | null = null;

// メインウィンドウを作成する関数
function createWindow(): void {
	console.log("Creating main window...");

	// プリロードスクリプトのパスを確認
	const preloadPath = path.join(__dirname, "../preload/index.js");
	console.log(`Preload script path: ${preloadPath}`);
	console.log(`File exists: ${require("fs").existsSync(preloadPath)}`);

	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			// セキュリティ設定を改善
			sandbox: false, // プリロードスクリプトのために必要
			webSecurity: true, // 常に有効化
			allowRunningInsecureContent: false, // 常に無効化
		},
		show: false,
		backgroundColor: "#FFFFFF",
	});

	// 開発環境であればDevToolsを開く
	if (!app.isPackaged) {
		mainWindow.webContents.openDevTools();
		console.log("DevTools opened");
	}

	// レンダラーに対してプリロードが正しく読み込まれたことをチェックする
	mainWindow.webContents.on("did-finish-load", () => {
		console.log("Renderer process loaded");
		mainWindow?.webContents
			.executeJavaScript(
				`
			console.log("Checking preload APIs...");
			console.log("electronAPI available:", !!window.electronAPI);
			console.log("mastraAPI available:", !!window.mastraAPI);
		`
			)
			.catch((err) => {
				console.error("Error checking preload APIs:", err);
			});
	});

	mainWindow.webContents.on(
		"did-fail-load",
		(event, errorCode, errorDescription) => {
			console.error(`Failed to load: ${errorDescription} (${errorCode})`);
		}
	);

	mainWindow.on("ready-to-show", () => {
		mainWindow?.show();
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});

	// レンダラープロセスのロード
	if (app.isPackaged) {
		mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
	} else {
		// 開発時はローカルサーバーからロード - ポート番号を5173に変更
		const url = `http://localhost:5173`;
		mainWindow.loadURL(url);
	}
}

// Electronのライフサイクルイベント: アプリが初期化されたとき
app.whenReady().then(() => {
	createWindow();

	app.on("activate", () => {
		// macOSでは、ウィンドウが閉じられても他のウィンドウが
		// 開かれていなければアプリケーションを終了せず、
		// ウィンドウが再作成されるのが一般的です
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

// Electronのライフサイクルイベント: すべてのウィンドウが閉じられたとき
app.on("window-all-closed", () => {
	// macOS以外では、すべてのウィンドウが閉じられたときに
	// アプリケーションを終了するのが一般的です
	if (process.platform !== "darwin") {
		app.quit();
	}
});

// IPC通信の設定
ipcMain.handle("dialog:openFile", async () => {
	const { canceled, filePaths } = await dialog.showOpenDialog({
		properties: ["openFile"],
	});
	if (canceled) {
		return undefined;
	} else {
		return filePaths[0];
	}
});

// ストリーミング用のIPC通信ハンドラ - Mastra SDK版
ipcMain.handle(
	"start-stream",
	async (event, { agentId, messages, threadId }) => {
		console.log(`Start streaming for agent ${agentId}`);
		console.log("Messages:", JSON.stringify(messages));

		try {
			// ユーザーメッセージのみを抽出（現在のユースケースに合わせる）
			const userMessages = messages
				.filter((msg: any) => msg.role === "user")
				.map((msg: any) => ({
					role: "user",
					content: msg.content,
				}));

			// 現在のウィンドウを取得
			const currentWindow = BrowserWindow.fromWebContents(event.sender);

			// MastraClientを使用してエージェントを取得
			const agent = mastraClient.getAgent(agentId);

			// ストリーミングレスポンスを取得
			const response = await agent.stream({
				messages: userMessages,
				threadId: threadId || undefined,
			});

			// ストリーミングレスポンスを処理
			await response.processDataStream({
				onTextPart: (text) => {
					// テキストチャンクをレンダラーに送信
					if (currentWindow && !currentWindow.isDestroyed()) {
						currentWindow.webContents.send(
							"stream-chunk",
							`0:"${text}"`
						);
					}
				},
				onErrorPart: (error) => {
					console.error("Stream error:", error);
					if (currentWindow && !currentWindow.isDestroyed()) {
						currentWindow.webContents.send(
							"stream-error",
							String(error)
						);
					}
				},
			});

			// 完了イベントを送信
			if (currentWindow && !currentWindow.isDestroyed()) {
				currentWindow.webContents.send("stream-end");
			}

			return {
				success: true,
				message: "ストリーミングが完了しました",
			};
		} catch (error: any) {
			console.error("Error in start-stream:", error);
			// エラー情報をレンダラーに返す
			return {
				success: false,
				error: error.message,
				details: error.response?.data || null,
			};
		}
	}
);

// フォールバック用の通常リクエストハンドラ - Mastra SDK版
ipcMain.handle(
	"send-message",
	async (event, { agentId, messages, threadId }) => {
		console.log(`Sending message to agent ${agentId}`);

		try {
			// メッセージを準備（システムメッセージは除外）
			const messagesToSend = messages
				.filter((msg: any) => msg.role !== "system")
				.map((msg: any) => ({
					role: msg.role,
					content: msg.content,
				}));

			console.log("Sending messages:", messagesToSend);

			// MastraClientを使用してエージェントを取得
			const agent = mastraClient.getAgent(agentId);

			// 非ストリーミングレスポンスを取得
			const response = await agent.generate({
				messages: messagesToSend,
				threadId: threadId || undefined,
			});

			return {
				success: true,
				response: response,
			};
		} catch (error: any) {
			console.error("Error in send-message:", error);
			return {
				success: false,
				error: error.message,
			};
		}
	}
);
