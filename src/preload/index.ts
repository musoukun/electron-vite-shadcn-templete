import { contextBridge, ipcRenderer } from "electron";

// デバッグ用のログ - プリロードスクリプトが実行されているか確認
console.log("===== Preload script starting =====");

// APIのベースURL
const API_BASE_URL = "http://localhost:4111";
console.log(`API_BASE_URL: ${API_BASE_URL}`);

// electronAPIの定義とエクスポート
try {
	console.log("Setting up electronAPI...");
	contextBridge.exposeInMainWorld("electronAPI", {
		openFile: () => ipcRenderer.invoke("dialog:openFile"),
		sendMessageToLLM: (message: string) => {
			console.log(`Message to LLM: ${message}`);
			return Promise.resolve("LLMからの応答がここに表示されます");
		},
	});
	console.log("electronAPI exposed successfully");
} catch (error) {
	console.error("Failed to expose electronAPI:", error);
}

// mastraAPIの定義とエクスポート
try {
	console.log("Setting up mastraAPI...");

	// APIメソッドの定義
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
			onChunk?: (chunk: string) => void
		) => {
			try {
				console.log(`Streaming request to agent ${agentId} via IPC`);
				console.log("Original messages:", JSON.stringify(messages));

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
								const unescapedContent = content.replace(/\\"/g, '"');
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
										const content = data.text || data.content || data.delta || "";
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
									const dataContent = text.substring(colonIndex + 1);
									
									// 有効なJSONかチェック
									if (dataContent.trim().startsWith('{') || dataContent.trim().startsWith('[')) {
										try {
											const data = JSON.parse(dataContent);
											
											// テキストコンテンツを探す
											if (data.content && Array.isArray(data.content)) {
												for (const item of data.content) {
													if (item.type === "text" && item.text) {
														if (onChunk) {
															onChunk(item.text);
														}
													}
												}
											}
										} catch (parseError) {
											// JSON解析に失敗しても継続
											console.warn("JSON解析エラー:", parseError);
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
					ipcRenderer.removeListener('stream-chunk', chunkListener);
					ipcRenderer.removeListener('stream-error', errorListener);
					ipcRenderer.removeListener('stream-end', endListener);
				};

				// リスナーを登録
				ipcRenderer.on('stream-chunk', chunkListener);
				ipcRenderer.on('stream-error', errorListener);
				ipcRenderer.on('stream-end', endListener);

				// IPCを通じてメインプロセスにストリーミング開始を依頼
				const result = await ipcRenderer.invoke('start-stream', {
					agentId,
					messages,
					threadId
				});

				// エラーチェック
				if (!result.success) {
					cleanup(); // リスナーをクリーンアップ
					throw new Error(result.error || "ストリーミングの開始に失敗しました");
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
			threadId?: string
		) => {
			try {
				console.log(`Sending message to agent ${agentId} via IPC`);
				
				// IPCを通じてメインプロセスにメッセージ送信を依頼
				const result = await ipcRenderer.invoke('send-message', {
					agentId,
					messages,
					threadId
				});
				
				// エラーチェック
				if (!result.success) {
					throw new Error(result.error || "メッセージの送信に失敗しました");
				}
				
				return { response: result.response || "" };
			} catch (error) {
				console.error("メッセージの送信に失敗しました:", error);
				throw error;
			}
		},

		// 新しいスレッドを作成
		createThread: async (agentId: string, title = "新しい会話") => {
			try {
				console.log(
					`Creating thread for agent: ${agentId}, title: ${title}`
				);

				// リクエストボディにresourceidを追加
				const response = await fetch(
					`${API_BASE_URL}/api/memory/threads?agentId=${agentId}`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify({
							title,
							resourceid: "default", // APIに必要なresourceidを追加
						}),
						mode: "cors",
						credentials: "omit",
					}
				);

				if (!response.ok) {
					throw new Error(`APIエラー: ${response.status}`);
				}

				const data = await response.json();
				console.log("Thread created:", data);
				return data;
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

				// resourceIdが指定されていない場合はデフォルト値を使用
				const actualResourceId = resourceId || "default";
				url.searchParams.append("resourceid", actualResourceId);

				console.log(
					`Getting threads for agent: ${agentId}, resourceId: ${actualResourceId}`
				);

				const response = await fetch(url.toString(), {
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
				console.log("Threads retrieved:", data);
				return data;
			} catch (error) {
				console.error("スレッド一覧の取得に失敗しました:", error);
				throw error;
			}
		},

		// スレッドのメッセージを取得
		getThreadMessages: async (threadId: string, agentId: string) => {
			try {
				const response = await fetch(
					`${API_BASE_URL}/api/memory/threads/${threadId}/messages?agentId=${agentId}`,
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
				console.error("スレッドメッセージの取得に失敗しました:", error);
				throw error;
			}
		},
	};

	// コンテキストブリッジでAPIを公開
	contextBridge.exposeInMainWorld("mastraAPI", mastraAPI);
	console.log("mastraAPI exposed successfully");

	// グローバル変数として設定（デバッグ用）
	// @ts-ignore
	window._mastraAPI = mastraAPI;
} catch (error) {
	console.error("Failed to expose mastraAPI:", error);
}

// プリロードスクリプトが完了したことを確認
console.log("===== Preload script completed =====");
