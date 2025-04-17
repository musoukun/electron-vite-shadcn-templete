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
	async (event, { agentId, messages, threadId, resourceId }) => {
		console.log(`Start streaming for agent ${agentId}`);
		console.log("Messages:", JSON.stringify(messages));
		console.log("Thread ID:", threadId || "No thread ID provided");
		console.log("Resource ID:", resourceId || "No resource ID provided");

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

			// ストリーミングレスポンスを取得（スレッドIDとリソースIDを使用）
			const response = await agent.stream({
				messages: userMessages,
				threadId: threadId || undefined,
				resourceId: resourceId || "default", // クライアントから送信されたリソースIDを使用
			});

			// ストリーミングレスポンスを処理
			await response.processDataStream({
				onTextPart: (text) => {
					// ワーキングメモリタグを除去
					const cleanedText = removeMetadataTags(text);

					// テキストチャンクをレンダラーに送信（空でなければ）
					if (
						cleanedText.trim() &&
						currentWindow &&
						!currentWindow.isDestroyed()
					) {
						currentWindow.webContents.send(
							"stream-chunk",
							`0:"${cleanedText}"`
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
	async (event, { agentId, messages, threadId, resourceId }) => {
		console.log(`Sending message to agent ${agentId}`);
		console.log("With threadId:", threadId || "No thread ID provided");
		console.log(
			"With resourceId:",
			resourceId || "No resource ID provided"
		);

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

			// 非ストリーミングレスポンスを取得（スレッドIDとリソースIDを使用）
			const response = await agent.generate({
				messages: messagesToSend,
				threadId: threadId || undefined,
				resourceId: resourceId || "default", // クライアントから送信されたリソースIDを使用
			});

			// レスポンスからテキストを抽出し、メタデータタグを除去
			let responseText = "";
			if (typeof response === "string") {
				responseText = removeMetadataTags(response);
			} else if (response && typeof response.text === "string") {
				responseText = removeMetadataTags(response.text);
			} else if (response && typeof response === "object") {
				// オブジェクトの場合はJSON文字列に変換（必要に応じて）
				responseText = JSON.stringify(response);
			}

			return {
				success: true,
				response: responseText,
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

// メモリ関連のハンドラを追加

// スレッド一覧取得ハンドラ
ipcMain.handle("get-threads", async (event, { agentId, resourceId }) => {
	console.log(`Getting threads for agent ${agentId}`);

	try {
		// MastraClientを使用してメモリスレッド一覧を取得
		const threads = await mastraClient.getMemoryThreads({
			agentId,
			resourceId: resourceId || "default",
		});

		return {
			success: true,
			threads: threads,
		};
	} catch (error: any) {
		console.error("Error in get-threads:", error);
		return {
			success: false,
			error: error.message,
		};
	}
});

// スレッド作成ハンドラ
ipcMain.handle(
	"create-thread",
	async (event, { agentId, title, resourceId }) => {
		console.log(`Creating thread for agent ${agentId}`);

		try {
			// MastraClientを使用して新しいスレッドを作成
			const thread = await mastraClient.createMemoryThread({
				agentId,
				title: title || "新しい会話",
				resourceid: resourceId || "default", // 注: APIは小文字のresourceidを使用
				metadata: {}, // 空のメタデータを追加
				threadId: `thread_${Date.now()}`, // 新しいスレッドIDを生成
			});

			return {
				success: true,
				thread: thread,
			};
		} catch (error: any) {
			console.error("Error in create-thread:", error);
			return {
				success: false,
				error: error.message,
			};
		}
	}
);

// スレッドのメッセージ取得ハンドラ
ipcMain.handle("get-thread-messages", async (event, { threadId, agentId }) => {
	console.log(`Getting messages for thread ${threadId}`);

	try {
		// スレッドインスタンスを取得
		const thread = mastraClient.getMemoryThread(threadId, agentId);
		// スレッドのメッセージを取得
		const messages = await thread.getMessages();

		return {
			success: true,
			messages: messages,
		};
	} catch (error: any) {
		console.error("Error in get-thread-messages:", error);
		return {
			success: false,
			error: error.message,
		};
	}
});

// スレッドタイトル更新ハンドラ
ipcMain.handle(
	"update-thread-title",
	async (event, { threadId, agentId, title, resourceId }) => {
		console.log(`Updating title for thread ${threadId} to "${title}"`);
		console.log(
			`Agent ID: ${agentId}, Resource ID: ${resourceId || "default"}`
		);

		try {
			// スレッドインスタンスを取得
			const thread = mastraClient.getMemoryThread(threadId, agentId);

			// スレッドのタイトルを更新
			const updatedThread = await thread.update({
				title: title,
				resourceid: resourceId || "default",
				metadata: {}, // 空のメタデータを追加
			});

			console.log("Thread title updated successfully:", updatedThread);

			return {
				success: true,
				thread: updatedThread,
			};
		} catch (error: any) {
			console.error("Error in update-thread-title:", error);
			return {
				success: false,
				error: error.message,
			};
		}
	}
);

// メタデータタグを除去する関数
function removeMetadataTags(text: string): string {
	// ワーキングメモリタグを除去
	return (
		text
			.replace(/<working_memory>[\s\S]*?<\/working_memory>/g, "")
			// その他のメタデータタグも必要に応じて除去
			.replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
			.trim()
	);
}
