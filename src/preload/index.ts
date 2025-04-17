import { contextBridge, ipcRenderer } from "electron";

// デバッグ用のログ - プリロードスクリプトが実行されているか確認
console.log("===== Preload script starting =====");

// APIのベースURL
const API_BASE_URL = "http://localhost:4111";
console.log(`API_BASE_URL: ${API_BASE_URL}`);

// --- API オブジェクトの定義 ---

const electronAPI = {
	openFile: () => ipcRenderer.invoke("dialog:openFile"),
	// sendMessageToLLM は削除 (使用されていないため)
};

const mastraAPI = {
	// 利用可能なAgentの一覧を取得
	getAgents: async () => {
		console.log("getAgents called");
		try {
			const response = await fetch(`${API_BASE_URL}/api/agents`, {
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				mode: "cors",
				credentials: "omit",
			});

			if (!response.ok) {
				throw new Error(`APIエラー: ${response.status}`);
			}

			const data = await response.json();
			console.log("getAgents result:", data);

			// レスポンスがオブジェクト形式の場合は配列に変換
			// {key1: value1, key2: value2} → [{id: key1, ...value1}, {id: key2, ...value2}]
			let agents = [];
			if (data && typeof data === "object" && !Array.isArray(data)) {
				agents = Object.entries(data).map(([id, details]) => ({
					id,
					...(typeof details === "object" ? details : {}),
				}));
				console.log("Converted agents to array:", agents);
			} else if (Array.isArray(data)) {
				agents = data;
			}

			return agents;
		} catch (error) {
			console.error("Agentの取得に失敗しました:", error);
			throw error;
		}
	},

	// AgentのIDからAgent詳細を取得
	getAgentDetails: async (agentId: string) => {
		try {
			const response = await fetch(
				`${API_BASE_URL}/api/agents/${agentId}`,
				{
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					mode: "cors",
					credentials: "omit",
				}
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

	// Agentにメッセージを送信して返答をストリーミングで取得 (IPC版)
	streamMessageFromAgent: async (
		agentId: string,
		messages: any[],
		threadId?: string,
		onChunk?: (chunk: string) => void,
		resourceId?: string
	) => {
		try {
			console.log(`Streaming request to agent ${agentId} via IPC`);
			console.log("Original messages:", JSON.stringify(messages));
			console.log("Thread ID:", threadId || "No thread ID");
			console.log("Resource ID:", resourceId || "No resource ID");

			// ストリームチャンクを受け取るリスナー
			const chunkListener = (_, text: string) => {
				// チャンクデータを処理
				if (text && text.trim()) {
					try {
						// テキスト行の解析
						console.log("Processing line:", text);

						// 0:"テキスト" 形式
						if (text.startsWith('0:"')) {
							// 0:"から始まるテキストを抽出して解析
							const content = text.substring(3, text.length - 1);
							// バックスラッシュをエスケープ解除
							const unescapedContent = content.replace(
								/\\"/g,
								'"'
							);
							if (onChunk) {
								onChunk(unescapedContent);
							}
							return;
						}

						// data: 形式のチェック（従来のSSE形式）
						if (text.startsWith("data:")) {
							try {
								const dataContent = text.substring(5).trim();
								if (dataContent) {
									const data = JSON.parse(dataContent);
									// テキスト内容を取り出す
									const content =
										data.text ||
										data.content ||
										data.delta ||
										"";
									if (content && onChunk) {
										onChunk(content);
									}
								}
							} catch (e) {
								console.error("SSEデータの解析エラー:", e);
							}
							return;
						}

						// その他のJSONデータの処理（f:, 9:, a:など）
						const colonIndex = text.indexOf(":");
						if (colonIndex > 0) {
							try {
								const prefix = text.substring(0, colonIndex);
								const dataContent = text.substring(
									colonIndex + 1
								);

								// 有効なJSONかチェック
								if (
									dataContent.trim().startsWith("{") ||
									dataContent.trim().startsWith("[")
								) {
									try {
										const data = JSON.parse(dataContent);

										// テキストコンテンツを探す
										if (
											data.content &&
											Array.isArray(data.content)
										) {
											for (const item of data.content) {
												if (
													item.type === "text" &&
													item.text
												) {
													if (onChunk) {
														onChunk(item.text);
													}
												}
											}
										}
									} catch (parseError) {
										// JSON解析に失敗しても継続
										console.warn(
											"JSON解析エラー:",
											parseError
										);
									}
								}
							} catch (error) {
								console.warn("行の処理に失敗:", error);
							}
						}
					} catch (e) {
						console.error("チャンク処理エラー:", e);
					}
				}
			};

			// エラーリスナー
			const errorListener = (_, errorMessage: string) => {
				console.error("ストリームエラー:", errorMessage);
			};

			// 完了リスナー
			const endListener = () => {
				console.log("ストリーム完了");
				// リスナーのクリーンアップ
				cleanup();
			};

			// リスナーのクリーンアップ関数
			const cleanup = () => {
				ipcRenderer.removeListener("stream-chunk", chunkListener);
				ipcRenderer.removeListener("stream-error", errorListener);
				ipcRenderer.removeListener("stream-end", endListener);
			};

			// リスナーを登録
			ipcRenderer.on("stream-chunk", chunkListener);
			ipcRenderer.on("stream-error", errorListener);
			ipcRenderer.on("stream-end", endListener);

			// IPCを通じてメインプロセスにストリーミング開始を依頼
			const result = await ipcRenderer.invoke("start-stream", {
				agentId,
				messages,
				threadId,
				resourceId: resourceId || "default",
			});

			// エラーチェック
			if (!result.success) {
				cleanup(); // リスナーをクリーンアップ
				throw new Error(
					result.error || "ストリーミングの開始に失敗しました"
				);
			}

			// 成功を返す（実際のレスポンスはイベントリスナー経由で取得）
			return { success: true };
		} catch (error) {
			console.error("メッセージのストリーミングに失敗しました:", error);
			throw error;
		}
	},

	// 従来の一括レスポンス方式のメッセージ送信（フォールバック用）- IPC版
	sendMessageToAgent: async (
		agentId: string,
		messages: any[],
		threadId?: string,
		resourceId?: string
	) => {
		try {
			console.log(`Sending message to agent: ${agentId}`);
			// 非ストリーミングモードでメッセージを送信
			const result = await ipcRenderer.invoke("send-message", {
				agentId,
				messages,
				threadId,
				resourceId: resourceId || "default",
			});

			if (!result.success) {
				throw new Error(result.error || "不明なエラー");
			}

			return result.response;
		} catch (error) {
			console.error("メッセージの送信に失敗しました:", error);
			throw error;
		}
	},

	// 新しいスレッドを作成 (IPC版に変更 - Mainプロセスで実行)
	createThread: async (
		agentId: string,
		title = "新しい会話",
		resourceId?: string
	) => {
		try {
			console.log(`Creating thread for agent: ${agentId} via IPC`);
			const result = await ipcRenderer.invoke("create-thread", {
				agentId,
				title,
				resourceId: resourceId || "default",
			});
			if (!result.success)
				throw new Error(result.error || "スレッド作成に失敗しました");
			console.log("Thread created:", result.thread);
			return result.thread;
		} catch (error) {
			console.error("スレッドの作成に失敗しました:", error);
			throw error;
		}
	},

	// スレッド一覧を取得 (IPC版に変更 - Mainプロセスで実行)
	getThreads: async (agentId: string, resourceId?: string) => {
		try {
			console.log(`Getting threads for agent: ${agentId} via IPC`);
			const result = await ipcRenderer.invoke("get-threads", {
				agentId,
				resourceId: resourceId || "default",
			});
			if (result.error) throw new Error(result.error);
			if (result.warning) console.warn(`警告: ${result.warning}`);
			const threads = result.threads || [];
			console.log(`取得したスレッド数 (${agentId}): ${threads.length}`);
			return threads;
		} catch (error) {
			console.error("スレッド一覧の取得に失敗しました:", error);
			throw error;
		}
	},

	// ユーザーのすべてのスレッドを取得（エージェント横断）- これはMainプロセスに任せるべき
	getAllThreads: async (resourceId?: string) => {
		try {
			console.log(
				`Getting all threads for resourceId: ${resourceId || "default"} via IPC`
			);
			const result = await ipcRenderer.invoke("get-all-threads", {
				// ハンドラ名は仮、Mainに実装必要
				resourceId: resourceId || "default",
			});
			if (result.error) throw new Error(result.error);
			if (result.warning) console.warn(`警告: ${result.warning}`);
			const threads = result.threads || [];
			console.log(`全スレッド数: ${threads.length}`);
			return threads;
		} catch (error) {
			console.error("全スレッド一覧の取得に失敗しました:", error);
			throw error;
		}
	},

	// スレッドのメッセージを取得 (IPC版に変更 - Mainプロセスで実行)
	getThreadMessages: async (
		threadId: string,
		agentId: string,
		resourceId?: string
	) => {
		try {
			console.log(`Getting messages for thread ${threadId} via IPC`);
			const result = await ipcRenderer.invoke("get-thread-messages", {
				threadId,
				agentId,
				resourceId: resourceId || "default",
			});
			if (result.error) throw new Error(result.error);
			if (result.warning) console.warn(`警告: ${result.warning}`);
			const messages = result.messages || [];
			console.log(
				`取得したメッセージ数 (${threadId}): ${messages.length}`
			);
			// メッセージ形式の変換・検証 (変更なし)
			let messagesArray = Array.isArray(messages) ? messages : [messages];
			if (messagesArray.length === 0) return [];
			messagesArray = messagesArray
				.map((msg: any) => {
					if (typeof msg === "string")
						return { role: "assistant", content: msg };
					if (msg.messages && Array.isArray(msg.messages))
						return msg.messages;
					return msg;
				})
				.flat();
			return messagesArray;
		} catch (error) {
			console.error("スレッドメッセージの取得に失敗しました:", error);
			throw error;
		}
	},

	// スレッドタイトルを更新 (IPC版 - Mainプロセスで実行)
	updateThreadTitle: async (
		threadId: string,
		agentId: string,
		title: string,
		resourceId?: string
	) => {
		try {
			console.log(`Updating thread title ${threadId} via IPC`);
			const result = await ipcRenderer.invoke("update-thread-title", {
				threadId,
				agentId,
				title,
				resourceId: resourceId || "default",
			});
			if (!result.success)
				throw new Error(result.error || "タイトル更新に失敗しました");
			console.log("Thread title updated:", result.thread);
			return result.thread;
		} catch (error) {
			console.error("スレッドタイトルの更新に失敗しました:", error);
			throw error;
		}
	},

	// スレッドを削除 (IPC版 - Mainプロセスで実行)
	deleteThread: async (threadId: string, agentId: string) => {
		try {
			console.log(`Deleting thread ${threadId} via IPC`);
			const result = await ipcRenderer.invoke("delete-thread", {
				threadId,
				agentId,
			});
			if (!result.success)
				throw new Error(result.error || "スレッドの削除に失敗しました");
			console.log(`Thread deleted successfully: ${threadId}`);
			return { success: true };
		} catch (error) {
			console.error(`スレッド ${threadId} の削除に失敗しました:`, error);
			throw error;
		}
	},
};

const electronShell = {
	openExternalLink: (url: string) =>
		ipcRenderer.invoke("open-external-link", url),
};

// --- API の公開 ---

if (process.contextIsolated) {
	try {
		console.log("Exposing APIs via contextBridge...");
		contextBridge.exposeInMainWorld("electronAPI", electronAPI);
		contextBridge.exposeInMainWorld("mastraAPI", mastraAPI);
		contextBridge.exposeInMainWorld("electronShell", electronShell);
		console.log("APIs exposed successfully.");

		// デバッグ用にグローバルにも設定 (オプション)
		// @ts-ignore
		window._mastraAPI = mastraAPI;
	} catch (error) {
		console.error("Failed to expose APIs:", error);
	}
} else {
	// contextIsolationが無効な場合のフォールバック (非推奨)
	console.warn(
		"Context Isolation is disabled. Exposing APIs directly to window."
	);
	// @ts-ignore
	window.electronAPI = electronAPI;
	// @ts-ignore
	window.mastraAPI = mastraAPI;
	// @ts-ignore
	window.electronShell = electronShell;
}

// プリロードスクリプトが完了したことを確認
console.log("===== Preload script completed =====");
