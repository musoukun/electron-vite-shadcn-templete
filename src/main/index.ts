import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import axios from "axios";

// コンソール出力のエンコーディングを設定（Windows環境用）
if (process.platform === "win32") {
	process.env.LANG = "ja_JP.UTF-8";
	// Windows環境でのコンソール出力をUTF-8に設定
	try {
		require("child_process").execSync("chcp 65001", { stdio: "ignore" });
	} catch (e) {
		console.error("コンソールのエンコーディング設定に失敗しました:", e);
	}
}

// Mastra API の設定
const MASTRA_API_BASE_URL = "http://localhost:4111/api";

// アプリのウィンドウを格納するグローバル参照
// これをしないとGCされてしまいます
let mainWindow: BrowserWindow | null = null;

// 選択されたモデル
let selectedModel: string = "gemini-2.0-flash-exp"; // デフォルトモデル

// メインウィンドウを作成する関数
function createWindow(): void {
	logInfo("Creating main window...");

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

// エージェント一覧を取得
ipcMain.handle("llm:getAgents", async () => {
	try {
		const response = await axios.get(`${MASTRA_API_BASE_URL}/agents`);
		return response.data;
	} catch (error) {
		logError("エージェント一覧の取得に失敗しました:", error);
		return { error: "エージェント一覧の取得に失敗しました" };
	}
});

// 利用可能なモデル一覧（実際のAPIから取得できれば理想的）
const AVAILABLE_MODELS = [
	{ id: "gemini-pro", name: "Gemini Pro" },
	{ id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
	{ id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
	{ id: "gemini-2.0-pro", name: "Gemini 2.0 Pro" },
	{ id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash exp" },
];

// 利用可能なモデル一覧を取得
ipcMain.handle("llm:getAvailableModels", async () => {
	return AVAILABLE_MODELS;
});

// モデルを選択
ipcMain.handle("llm:selectModel", async (_event, modelId: string) => {
	try {
		selectedModel = modelId;
		logInfo(`モデルを選択しました: ${modelId}`);
		return { success: true, message: `モデル ${modelId} を選択しました` };
	} catch (error) {
		logError("モデルの選択中にエラーが発生しました:", error);
		return {
			success: false,
			message: "モデルの選択中にエラーが発生しました",
		};
	}
});

// 選択されたモデルを取得
ipcMain.handle("llm:getSelectedModel", async () => {
	return selectedModel;
});

// メッセージ送信ハンドラー
ipcMain.handle(
	"llm:sendMessage",
	async (_event, message: string, agentId: string = "chatAgent") => {
		logInfo(`エージェント ${agentId} にメッセージを送信: ${message}`);

		try {
			// Mastra API を使用してメッセージを処理
			// ここでモデルを指定して送信
			const response = await axios.post(
				`${MASTRA_API_BASE_URL}/agents/${agentId}/generate`,
				{
					messages: [{ role: "user", content: message }],
					model: selectedModel, // ここでモデルを指定
				}
			);

			return (
				response.data.text ||
				response.data.content ||
				"応答がありませんでした"
			);
		} catch (error) {
			logError("LLMとの通信中にエラーが発生しました:", error);
			return "エラーが発生しました。しばらくしてからもう一度お試しください。";
		}
	}
);

// ログ出力用の関数
function logInfo(message: string): void {
	// Windows環境では文字化けを防ぐためにバッファを使用
	if (process.platform === "win32") {
		const buffer = Buffer.from(message, "utf8");
		console.log(buffer.toString("utf8"));
	} else {
		console.log(message);
	}
}

function logError(message: string, error?: any): void {
	if (process.platform === "win32") {
		const buffer = Buffer.from(message, "utf8");
		console.error(buffer.toString("utf8"), error || "");
	} else {
		console.error(message, error || "");
	}
}
