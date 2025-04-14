import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
	HumanMessage,
	AIMessage,
	SystemMessage,
} from "@langchain/core/messages";

// アプリのウィンドウを格納するグローバル参照
// これをしないとGCされてしまいます
let mainWindow: BrowserWindow | null = null;

// LLMの設定
let apiKey: string | null = null;
let chatModel: ChatGoogleGenerativeAI | null = null;
let chatHistory: Array<HumanMessage | AIMessage | SystemMessage> = [];

// LLMの初期化関数
function initializeLLM() {
	if (!apiKey) {
		console.log("API Keyが設定されていません");
		return false;
	}

	try {
		chatModel = new ChatGoogleGenerativeAI({
			apiKey: apiKey,
			model: "gemini-2.0-flash-exp",
			maxOutputTokens: 1025,
			temperature: 0,
			topK: 1,
			topP: 1,
		});

		// システムメッセージで会話を初期化
		chatHistory = [
			new SystemMessage(
				"あなたは親切なAIアシスタントです。ユーザーの質問に簡潔に答えてください。"
			),
		];

		return true;
	} catch (error) {
		console.error("LLMの初期化に失敗しました:", error);
		return false;
	}
}

// メインウィンドウを作成する関数
function createWindow(): void {
	console.log("Creating main window...");

	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
		},
		show: false,
		backgroundColor: "#FFFFFF",
	});

	// 開発環境であればDevToolsを開く
	if (!app.isPackaged) {
		mainWindow.webContents.openDevTools();
	}

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

// LLMメッセージ送信ハンドラー
ipcMain.handle("llm:sendMessage", async (_event, message: string) => {
	console.log(`LLMにメッセージを送信: ${message}`);

	if (!chatModel) {
		if (!initializeLLM()) {
			return "APIキーが設定されていないか、LLMの初期化に失敗しました。設定から適切なAPIキーを設定してください。";
		}
	}

	try {
		// ユーザーメッセージを履歴に追加
		const userMessage = new HumanMessage(message);
		chatHistory.push(userMessage);

		// LLMに送信して応答を取得
		const response = await chatModel!.invoke(chatHistory);

		// AIの応答を履歴に追加
		chatHistory.push(response);

		return response.content;
	} catch (error) {
		console.error("LLMとの通信中にエラーが発生しました:", error);
		return "エラーが発生しました。しばらくしてからもう一度お試しください。";
	}
});

// APIキー設定ハンドラー
ipcMain.handle("llm:setApiKey", async (_event, newApiKey: string) => {
	console.log("APIキーを設定します");

	try {
		apiKey = newApiKey;
		const success = initializeLLM();

		if (success) {
			if (mainWindow) {
				mainWindow.webContents.send("api-key-update", {
					success: true,
					message: "APIキーが正常に設定されました",
				});
			}
			return { success: true, message: "APIキーが正常に設定されました" };
		} else {
			if (mainWindow) {
				mainWindow.webContents.send("api-key-update", {
					success: false,
					message: "APIキーの設定に失敗しました",
				});
			}
			return { success: false, message: "APIキーの設定に失敗しました" };
		}
	} catch (error) {
		console.error("APIキーの設定中にエラーが発生しました:", error);
		if (mainWindow) {
			mainWindow.webContents.send("api-key-update", {
				success: false,
				message: "APIキーの設定中にエラーが発生しました",
			});
		}
		return {
			success: false,
			message: "APIキーの設定中にエラーが発生しました",
		};
	}
});

// 設定ダイアログを開くハンドラー
ipcMain.on("open-settings-dialog", () => {
	// 設定ダイアログの実装は後で追加
	console.log("設定ダイアログを開きます");
});
