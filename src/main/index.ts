// globalにmastraApiErrorプロパティ追加
declare global {
	namespace NodeJS {
		interface Global {
			mastraApiError?: string;
		}
	}
}

import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import axios from "axios";

// コンソール出力のエンコーディングを設定（Windows環境用）
if (process.platform === "win32") {
	process.env.LANG = "ja_JP.UTF-8";
	// Windows環境でのコンソール出力をUTF-8に設定
	try {
		require("child_process").execSync("chcp 932", { stdio: "ignore" });
	} catch (e) {
		console.error("コンソールのエンコーディング設定に失敗しました:", e);
	}
}

// Mastra API の設定
const MASTRA_API_BASE_URL = "http://localhost:4111/api";
console.log(`Mastra API URL: ${MASTRA_API_BASE_URL}`);

// アプリのウィンドウを格納するグローバル参照
// これをしないとGCされてしまいます
let mainWindow: BrowserWindow | null = null;

// 選択されたエージェントID
let selectedAgentId: string = "gemini-2.0-flash-001";

// Mastra APIの健全性をチェックする関数
async function checkMastraApiHealth(): Promise<boolean> {
	try {
		console.log("Mastra APIの健全性をチェック中...");
		// OpenAPI仕様に基づき、/apiエンドポイントを最初に試します
		try {
			const response = await axios.get(
				`${MASTRA_API_BASE_URL.replace(/\/api$/, "")}`,
				{ timeout: 5000 }
			);
			console.log(
				`Mastra API健全性チェック応答 (/api): ${JSON.stringify(response.data)}`
			);
			return response.status === 200;
		} catch (apiError) {
			// /apiエンドポイントが失敗した場合、/agentsエンドポイントを試します
			console.log(
				"Mastra API /api エンドポイントが失敗したため、/agents を試します"
			);
			const response = await axios.get(`${MASTRA_API_BASE_URL}/agents`, {
				timeout: 5000,
			});
			console.log(
				`Mastra API健全性チェック応答 (agents): ${JSON.stringify(response.data)}`
			);
			return response.status === 200;
		}
	} catch (error: any) {
		console.error("Mastra API健全性チェックに失敗:", error);
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
app.whenReady().then(async () => {
	// Mastra APIの健全性チェック
	const isMastraApiHealthy = await checkMastraApiHealth();
	if (!isMastraApiHealthy) {
		console.error(
			"Mastra APIに接続できません。サーバーが起動しているか確認してください。"
		);
		// API接続エラーをグローバル変数に格納（レンダラープロセスで参照可能）
		global.mastraApiError =
			"Mastra APIサーバーに接続できません。サーバーが起動しているか確認してください。";
	}

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
	// Mastra APIの接続エラーがあればダミーエージェントを返す
	if (global.mastraApiError) {
		console.error("Mastra API接続エラーのためダミーエージェントを返します");
		return [
			{ id: "gemini-2.0-flash-001", name: "Gemini 2.0 Flash 001" },
			{ id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Exp" },
		];
	}

	try {
		console.log(`エージェント一覧を取得中: ${MASTRA_API_BASE_URL}/agents`);
		const response = await axios.get(`${MASTRA_API_BASE_URL}/agents`);
		console.log(
			`エージェント一覧取得成功: ${JSON.stringify(response.data)}`
		);

		// レスポンスをオブジェクトから配列に変換する処理
		let agentsList = [];
		if (response.data && typeof response.data === "object") {
			if (Array.isArray(response.data)) {
				agentsList = response.data;
			} else {
				// オブジェクト形式の場合、配列に変換
				agentsList = Object.entries(response.data).map(
					([id, agent]) => {
						// agent に型アサーションを追加
						const typedAgent = agent as { name?: string };
						return {
							id,
							name: typedAgent.name || id,
						};
					}
				);
			}
		}

		console.log(`処理済みエージェント一覧: ${JSON.stringify(agentsList)}`);

		// 配列が空の場合はダミーエージェントを返す
		if (agentsList.length === 0) {
			console.error("エージェントが見つかりませんでした");
			return [
				{ id: "gemini-2.0-flash-001", name: "Gemini 2.0 Flash 001" },
				{ id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Exp" },
			];
		}

		// エージェント一覧を返す
		return agentsList;
	} catch (error: any) {
		console.error("エージェント一覧の取得に失敗しました:", error);

		// エラー詳細を出力
		if (error.response) {
			console.error(`ステータスコード: ${error.response.status}`);
			console.error(`レスポンス: ${JSON.stringify(error.response.data)}`);
		} else if (error.request) {
			console.error(
				"サーバーからの応答がありません。Mastraサーバーが起動しているか確認してください。"
			);
		} else {
			console.error(`エラーメッセージ: ${error.message}`);
		}

		// エラー時はダミーエージェントを返す
		return [
			{ id: "gemini-2.0-flash-001", name: "Gemini 2.0 Flash 001" },
			{ id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Exp" },
		];
	}
});

// エージェントを選択
ipcMain.handle("llm:selectAgent", async (_event, agentId: string) => {
	try {
		selectedAgentId = agentId;
		console.log(`エージェントを選択しました: ${agentId}`);
		return {
			success: true,
			message: `エージェント ${agentId} を選択しました`,
		};
	} catch (error) {
		console.error("エージェントの選択中にエラーが発生しました:", error);
		return {
			success: false,
			message: "エージェントの選択中にエラーが発生しました",
		};
	}
});

// 選択されたエージェントを取得
ipcMain.handle("llm:getSelectedAgent", async () => {
	return selectedAgentId;
});

// モデル関連のハンドラーは削除または無効化
ipcMain.handle("llm:getAvailableModels", async () => {
	// モデル一覧の取得は非推奨になったことを通知
	console.log("モデル一覧の取得はエージェント一覧の取得に置き換えられました");
	return [];
});

ipcMain.handle("llm:selectModel", async (_event, modelId: string) => {
	// モデル選択は非推奨になったことを通知
	console.log("モデル選択はエージェント選択に置き換えられました");
	return {
		success: false,
		message:
			"モデル選択は非推奨です。代わりにエージェント選択を使用してください。",
	};
});

ipcMain.handle("llm:getSelectedModel", async () => {
	// 後方互換性のために選択されたエージェントIDを返す
	return selectedAgentId;
});

// メッセージ送信ハンドラー
ipcMain.handle(
	"llm:sendMessage",
	async (_event, message: string, agentId: string = "") => {
		// 指定がなければ選択中のエージェントを使用
		const targetAgentId = agentId || selectedAgentId;

		console.log(
			`エージェント ${targetAgentId} にメッセージを送信: ${message}`
		);

		try {
			// generateエンドポイントを使用
			const requestUrl = `${MASTRA_API_BASE_URL}/agents/${targetAgentId}/generate`;

			// 成功しているリクエスト構造に合わせる
			const requestBody = {
				messages: [
					{
						role: "user",
						content: message,
					},
				],
				runId: targetAgentId, // agentIdをrunIdとして使用
				maxRetries: 2,
				maxSteps: 5,
				temperature: 0.5,
				topP: 1,
			};

			console.log(`リクエストURL: ${requestUrl}`);
			console.log(`リクエスト内容: ${JSON.stringify(requestBody)}`);

			// Mastra API を使用してメッセージを処理
			const response = await axios.post(requestUrl, requestBody);

			// レスポンスをログに出力
			console.log(`レスポンス: ${JSON.stringify(response.data)}`);

			// 返却データの構造に基づいて応答を取得
			let result;
			if (response.data.text) {
				// テキスト応答の場合
				result = response.data.text;
			} else if (response.data.content) {
				// content属性がある場合
				result = response.data.content;
			} else if (typeof response.data === "string") {
				// 直接文字列が返された場合
				result = response.data;
			} else {
				// その他の形式の場合はJSONに変換
				result = JSON.stringify(response.data);
			}

			console.log(`返却する応答: ${result}`);
			return result;
		} catch (error: any) {
			// エラー詳細を出力
			console.error("LLMとの通信中にエラーが発生しました:", error);

			// Mastraサーバーへの再接続を試みる
			const isHealthy = await checkMastraApiHealth();
			if (!isHealthy) {
				return "Mastraサーバーに接続できません。サーバーが起動しているか確認してください。";
			}

			if (error.response) {
				// サーバーからのレスポンスがある場合
				console.error(`ステータスコード: ${error.response.status}`);
				console.error(
					`レスポンス: ${JSON.stringify(error.response.data)}`
				);

				// モデル関連のエラーの場合、別のモデルを提案
				if (
					error.response.data?.error?.includes("model") ||
					error.response.data?.error?.includes("function")
				) {
					selectedAgentId = "gemini-2.0-flash-001"; // より安定したモデルに切り替え
					console.log(
						`モデルエラーが発生したため、エージェントを ${selectedAgentId} に変更します`
					);
					return `モデルでエラーが発生したため、より安定した "gemini-2.0-flash-001" エージェントに切り替えました。もう一度メッセージを送信してください。`;
				}

				return `エラーが発生しました: ${error.response.data?.error || "不明なエラー"}`;
			} else if (error.request) {
				// リクエストは送信されたがレスポンスがない場合
				console.error(
					"サーバーからの応答がありません。Mastraサーバーが起動しているか確認してください。"
				);
				return "サーバーから応答がありません。Mastraサーバーが起動しているか確認してください。";
			} else {
				// リクエスト設定中にエラーが発生した場合
				console.error(`エラーメッセージ: ${error.message}`);
				return `エラーが発生しました: ${error.message}`;
			}
		}
	}
);
