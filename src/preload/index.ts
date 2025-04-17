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
								const content = text.substring(
									3,
									text.length - 1
								);
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
									const dataContent = text
										.substring(5)
										.trim();
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
									const prefix = text.substring(
										0,
										colonIndex
									);
									const dataContent = text.substring(
										colonIndex + 1
									);

									// 有効なJSONかチェック
									if (
										dataContent.trim().startsWith("{") ||
										dataContent.trim().startsWith("[")
									) {
										try {
											const data =
												JSON.parse(dataContent);

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
				console.error(
					"メッセージのストリーミングに失敗しました:",
					error
				);
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

		// 新しいスレッドを作成
		createThread: async (
			agentId: string,
			title = "新しい会話",
			resourceId?: string
		) => {
			try {
				// デフォルトのリソースID値 - 将来的に設定可能になるまでこれを使用
				const defaultResourceId = "default";

				// 使用するリソースID
				const actualResourceId = resourceId || defaultResourceId;

				console.log(
					`Creating thread for agent: ${agentId}, title: ${title}, resourceId: ${actualResourceId}`
				);

				// クエリパラメータとして必要なのはagentIdのみ
				const url = new URL(`${API_BASE_URL}/api/memory/threads`);
				url.searchParams.append("agentId", agentId);

				// リクエストボディを作成 - resourceIdは必須、titleはオプション
				const requestBody = {
					resourceId: actualResourceId,
					title: title || "新しい会話",
					// 将来的に必要になる可能性があるmetadataは今は空オブジェクトとして渡す
					metadata: {},
				};

				// APIリクエスト実行
				const response = await fetch(url.toString(), {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify(requestBody),
					mode: "cors",
					credentials: "omit",
				});

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
				// デフォルトのリソースID値 - 将来的に設定可能になるまでこれを使用
				const defaultResourceId = "default";

				// 使用するリソースID
				const actualResourceId = resourceId || defaultResourceId;

				const url = new URL(`${API_BASE_URL}/api/memory/threads`);
				url.searchParams.append("agentId", agentId);

				// リソースIDをクエリパラメータとして追加 - 小文字のresourceidを使用（APIの仕様に合わせる）
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

		// ユーザーのすべてのスレッドを取得（エージェント横断）
		getAllThreads: async (resourceId?: string) => {
			try {
				// デフォルトのリソースID値
				const defaultResourceId = "default";

				// 使用するリソースID
				const actualResourceId = resourceId || defaultResourceId;

				console.log(
					`Getting all threads for resourceId: ${actualResourceId}`
				);

				// IPCを使用してメインプロセスに全スレッド取得をリクエスト
				const result = await ipcRenderer.invoke("get-all-threads", {
					resourceId: actualResourceId,
				});

				// エラーメッセージがある場合は例外をスロー
				if (result.error) {
					throw new Error(result.error);
				}

				// 警告がある場合はログに出力
				if (result.warning) {
					console.warn(`警告: ${result.warning}`);
				}

				const threads = result.threads || [];
				console.log(`全スレッド数: ${threads.length}`);

				if (threads.length > 0) {
					console.log("最初のスレッド例:", threads[0]);
				}

				return threads;
			} catch (error) {
				console.error("全スレッド一覧の取得に失敗しました:", error);
				// エラーを上位に伝播
				throw error;
			}
		},

		// スレッドのメッセージを取得
		getThreadMessages: async (
			threadId: string,
			agentId: string,
			resourceId?: string
		) => {
			try {
				// デフォルトのリソースID値 - 将来的に設定可能になるまでこれを使用
				const defaultResourceId = "default";

				// 使用するリソースID
				const actualResourceId = resourceId || defaultResourceId;

				const url = new URL(
					`${API_BASE_URL}/api/memory/threads/${threadId}/messages`
				);
				url.searchParams.append("agentId", agentId);

				// リソースIDをクエリパラメータとして追加 - 小文字のresourceidを使用（APIの仕様に合わせる）
				url.searchParams.append("resourceid", actualResourceId);

				const requestUrl = url.toString();
				console.log(
					`Getting messages for thread: ${threadId}, agent: ${agentId}, resourceId: ${actualResourceId}`
				);
				console.log(`リクエストURL: ${requestUrl}`);

				// フェッチオプションを設定（タイムアウトを長めに設定）
				const fetchOptions = {
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					mode: "cors" as RequestMode,
					credentials: "omit" as RequestCredentials,
					timeout: 15000, // タイムアウトを15秒に設定
				};

				console.log("Fetch開始...");
				const response = await fetch(requestUrl, fetchOptions);
				console.log(`Fetchレスポンスステータス: ${response.status}`);

				if (!response.ok) {
					const errorText = await response.text();
					console.error(`APIエラー ${response.status}: ${errorText}`);
					throw new Error(
						`APIエラー: ${response.status} - ${errorText}`
					);
				}

				// レスポンスデータをJSON形式で取得
				console.log("レスポンスJSONパース開始...");
				const responseText = await response.text();
				console.log(
					`レスポンステキスト (先頭100文字): ${responseText.substring(0, 100)}...`
				);

				let data;
				try {
					data = JSON.parse(responseText);
				} catch (parseError) {
					console.error("JSONパースエラー:", parseError);
					console.error("レスポンステキスト全体:", responseText);
					throw new Error(`JSONパースエラー: ${parseError}`);
				}

				console.log("データ型:", typeof data);
				console.log("Thread messages received:", data);

				// 結果の検証と変換
				if (data) {
					// 配列でない場合は配列に変換
					let messagesArray = Array.isArray(data) ? data : [data];

					// 空チェック
					if (messagesArray.length === 0) {
						console.warn("メッセージ配列が空です");
						return [];
					}

					// メッセージの構造を確認・修正
					messagesArray = messagesArray.map((msg: any) => {
						// メッセージが文字列の場合
						if (typeof msg === "string") {
							console.log(
								"文字列メッセージを変換:",
								msg.substring(0, 50)
							);
							return {
								role: "assistant", // デフォルト
								content: msg,
							};
						}

						// messagesプロパティが配列の場合（ネストしたレスポンス構造）
						if (msg.messages && Array.isArray(msg.messages)) {
							console.log("ネストしたmessages配列を検出");
							return msg.messages;
						}

						// オブジェクトとして返す
						return msg;
					});

					// 配列のフラット化（ネストした配列を1レベルにする）
					messagesArray = messagesArray.flat();

					console.log(
						`取得したメッセージ数: ${messagesArray.length}`
					);
					if (messagesArray.length > 0) {
						console.log(`最初のメッセージ例:`, messagesArray[0]);
					}

					return messagesArray;
				}

				// データがない場合は空配列を返す
				console.warn("データが取得できませんでした");
				return [];
			} catch (error) {
				console.error("スレッドメッセージの取得に失敗しました:", error);
				throw error;
			}
		},

		// スレッドタイトルを更新
		updateThreadTitle: async (
			threadId: string,
			agentId: string,
			title: string,
			resourceId?: string
		) => {
			try {
				// デフォルトのリソースID値
				const defaultResourceId = "default";

				// 使用するリソースID
				const actualResourceId = resourceId || defaultResourceId;

				console.log(
					`Updating thread title: ${threadId}, agent: ${agentId}, new title: ${title}`
				);

				// IPCを使用してメインプロセスにリクエストを送信
				const result = await ipcRenderer.invoke("update-thread-title", {
					threadId,
					agentId,
					title,
					resourceId: actualResourceId,
				});

				if (!result.success) {
					throw new Error(
						result.error || "タイトル更新に失敗しました"
					);
				}

				console.log("Thread title updated:", result.thread);
				return result.thread;
			} catch (error) {
				console.error("スレッドタイトルの更新に失敗しました:", error);
				throw error;
			}
		},

		// スレッドを削除
		deleteThread: async (threadId: string, agentId: string) => {
			try {
				console.log(
					`Deleting thread: ${threadId} for agent: ${agentId}`
				);
				// IPCを使用してメインプロセスに削除をリクエスト
				const result = await ipcRenderer.invoke("delete-thread", {
					threadId,
					agentId,
				});

				if (!result.success) {
					throw new Error(
						result.error || "スレッドの削除に失敗しました"
					);
				}

				console.log(`Thread deleted successfully: ${threadId}`);
				return { success: true };
			} catch (error) {
				console.error(
					`スレッド ${threadId} の削除に失敗しました:`,
					error
				);
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

// MastraAPI用のIPCラッパー作成
const _mastraAPI: any = {
	// Agentの一覧を取得
	getAgents: async () => {
		try {
			console.log("Fetching agents from API...");
			const response = await fetch(`${API_BASE_URL}/api/agents`, {
				headers: {
					Accept: "application/json",
				},
				mode: "cors",
				credentials: "omit",
			});

			if (!response.ok) {
				throw new Error(`APIエラー: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Agentの取得に失敗しました:", error);
			throw error;
		}
	},

	// Agentにメッセージを送信（非ストリーミング）
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

	// Agentに対してストリーミングメッセージを送信
	streamMessageFromAgent: async (
		agentId: string,
		messages: any[],
		threadId?: string,
		onChunk?: (chunk: string) => void,
		resourceId?: string
	) => {
		return new Promise<void>((resolve, reject) => {
			try {
				// イベントリスナーを登録
				const chunkListener = (_: any, data: string) => {
					try {
						// データをパースして内容を取得
						const parts = data.split(":");
						const content = parts[1].replace(/^"|"$/g, "");

						if (onChunk) {
							onChunk(content);
						}
					} catch (e) {
						console.error("データの解析に失敗:", e, data);
						// エラー時でもストリームは継続
					}
				};

				const errorListener = (_: any, error: string) => {
					console.error("ストリームエラー:", error);
					cleanup();
					reject(new Error(error));
				};

				const endListener = () => {
					cleanup();
					resolve();
				};

				// クリーンアップ関数
				const cleanup = () => {
					if (ipcRenderer) {
						ipcRenderer.removeListener(
							"stream-chunk",
							chunkListener
						);
						ipcRenderer.removeListener(
							"stream-error",
							errorListener
						);
						ipcRenderer.removeListener("stream-end", endListener);
					}
				};

				// イベントリスナーを登録
				ipcRenderer.on("stream-chunk", chunkListener);
				ipcRenderer.on("stream-error", errorListener);
				ipcRenderer.on("stream-end", endListener);

				// ストリーミングを開始
				ipcRenderer
					.invoke("start-stream", {
						agentId,
						messages,
						threadId,
						resourceId: resourceId || "default",
					})
					.then((result: any) => {
						if (!result.success) {
							cleanup();
							reject(
								new Error(
									result.error ||
										"ストリーム開始に失敗しました"
								)
							);
						}
						// 成功の場合は、endListenerが呼ばれるのを待つ
					})
					.catch((error: any) => {
						cleanup();
						reject(error);
					});
			} catch (error) {
				console.error("ストリーミング開始に失敗:", error);
				reject(error);
			}
		});
	},

	// 新しいスレッドを作成
	createThread: async (
		agentId: string,
		title = "新しい会話",
		resourceId?: string
	) => {
		try {
			// デフォルトのリソースID値 - 将来的に設定可能になるまでこれを使用
			const defaultResourceId = "default";

			// 使用するリソースID
			const actualResourceId = resourceId || defaultResourceId;

			console.log(
				`Creating thread for agent: ${agentId}, title: ${title}, resourceId: ${actualResourceId}`
			);

			// クエリパラメータとして必要なのはagentIdのみ
			const url = new URL(`${API_BASE_URL}/api/memory/threads`);
			url.searchParams.append("agentId", agentId);

			// リクエストボディを作成 - resourceIdは必須、titleはオプション
			const requestBody = {
				resourceId: actualResourceId,
				title: title || "新しい会話",
				// 将来的に必要になる可能性があるmetadataは今は空オブジェクトとして渡す
				metadata: {},
			};

			// APIリクエスト実行
			const response = await fetch(url.toString(), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify(requestBody),
				mode: "cors",
				credentials: "omit",
			});

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
			// デフォルトのリソースID値 - 将来的に設定可能になるまでこれを使用
			const defaultResourceId = "default";

			// 使用するリソースID
			const actualResourceId = resourceId || defaultResourceId;

			const url = new URL(`${API_BASE_URL}/api/memory/threads`);
			url.searchParams.append("agentId", agentId);

			// リソースIDをクエリパラメータとして追加 - 小文字のresourceidを使用（APIの仕様に合わせる）
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
	getThreadMessages: async (
		threadId: string,
		agentId: string,
		resourceId?: string
	) => {
		try {
			// デフォルトのリソースID値 - 将来的に設定可能になるまでこれを使用
			const defaultResourceId = "default";

			// 使用するリソースID
			const actualResourceId = resourceId || defaultResourceId;

			const url = new URL(
				`${API_BASE_URL}/api/memory/threads/${threadId}/messages`
			);
			url.searchParams.append("agentId", agentId);

			// リソースIDをクエリパラメータとして追加 - 小文字のresourceidを使用（APIの仕様に合わせる）
			url.searchParams.append("resourceid", actualResourceId);

			const requestUrl = url.toString();
			console.log(
				`Getting messages for thread: ${threadId}, agent: ${agentId}, resourceId: ${actualResourceId}`
			);
			console.log(`リクエストURL: ${requestUrl}`);

			// フェッチオプションを設定（タイムアウトを長めに設定）
			const fetchOptions = {
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				mode: "cors" as RequestMode,
				credentials: "omit" as RequestCredentials,
				timeout: 15000, // タイムアウトを15秒に設定
			};

			console.log("Fetch開始...");
			const response = await fetch(requestUrl, fetchOptions);
			console.log(`Fetchレスポンスステータス: ${response.status}`);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`APIエラー ${response.status}: ${errorText}`);
				throw new Error(`APIエラー: ${response.status} - ${errorText}`);
			}

			const data = await response.json();
			console.log("Thread messages received:", data);

			// 結果の検証
			if (Array.isArray(data)) {
				console.log(`取得したメッセージ数: ${data.length}`);
				if (data.length > 0) {
					console.log(`最初のメッセージ例:`, data[0]);
				}
			} else {
				console.warn(`予期しないデータ形式: ${typeof data}`, data);
			}

			return data;
		} catch (error) {
			console.error("スレッドメッセージの取得に失敗しました:", error);
			throw error;
		}
	},
};

// プリロードスクリプトが完了したことを確認
console.log("===== Preload script completed =====");
