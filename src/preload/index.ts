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

		// Agentにメッセージを送信して返答をストリーミングで取得
		streamMessageFromAgent: async (
			agentId: string,
			messages: any[],
			threadId?: string,
			onChunk?: (chunk: string) => void
		) => {
			try {
				console.log(`Streaming request to agent ${agentId}`);
				console.log("Original messages:", JSON.stringify(messages));

				// ユーザーメッセージのみを抽出（APIの要件に合わせる）
				const userMessages = messages
					.filter((msg) => msg.role === "user")
					.map((msg) => ({
						role: "user",
						content: msg.content,
					}));

				// APIが期待する形式でリクエストを構築
				const requestBody = {
					messages: userMessages,
					runId: agentId, // エージェントIDをrunIdとして使用
					maxRetries: 2,
					maxSteps: 5,
					temperature: 0.5,
					topP: 1,
				};

				console.log("Request payload:", JSON.stringify(requestBody));

				const response = await fetch(
					`${API_BASE_URL}/api/agents/${agentId}/stream`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify(requestBody),
						mode: "cors",
						credentials: "omit",
					}
				);

				console.log("Stream response:", response);

				if (!response.ok) {
					throw new Error(`APIエラー: ${response.status}`);
				}

				console.log("Stream response started");

				// ストリームレスポンスの読み取り
				const reader = response.body?.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				if (reader) {
					while (true) {
						const { value, done } = await reader.read();

						if (done) {
							console.log("Stream response completed");
							break;
						}

						// バイナリデータをテキストに変換
						const text = decoder.decode(value, { stream: true });
						console.log("Received chunk:", text); // デバッグ用
						buffer += text;

						// SSEフォーマットの処理
						const lines = buffer.split("\n");
						buffer = lines.pop() || "";

						for (const line of lines) {
							console.log("Processing line:", line); // デバッグ用

							if (line.trim()) {
								try {
									// 0:"テキスト" 形式のチェック（テキストデータ）
									if (line.startsWith('0:"')) {
										// 0:"から始まるテキストを抽出
										const content = line.substring(
											3,
											line.length - 1
										);
										// バックスラッシュをエスケープ解除
										const unescapedContent =
											content.replace(/\\"/g, '"');
										if (onChunk) {
											onChunk(unescapedContent);
										}
										continue;
									}

									// data: 形式のチェック（従来のSSE形式）
									if (line.startsWith("data:")) {
										const dataContent = line
											.substring(5)
											.trim();
										const data = JSON.parse(dataContent);

										// 従来の処理
										if (
											data.text ||
											data.content ||
											data.delta
										) {
											const content =
												data.text ||
												data.content ||
												data.delta ||
												"";
											if (content && onChunk) {
												onChunk(content);
											}
										}
										continue;
									}

									// その他のJSONデータの処理（f:, 9:, a:など）
									const colonIndex = line.indexOf(":");
									if (colonIndex > 0) {
										try {
											const dataContent = line.substring(
												colonIndex + 1
											);
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
											console.error(
												"Parsing error for line with colon:",
												parseError
											);
										}
									}
								} catch (e) {
									console.error(
										"JSON解析エラー:",
										e,
										"Line:",
										line
									);
								}
							}
						}
					}
				}

				return { success: true };
			} catch (error) {
				console.error(
					"メッセージのストリーミングに失敗しました:",
					error
				);
				throw error;
			}
		},

		// 従来の一括レスポンス方式のメッセージ送信（フォールバック用）
		sendMessageToAgent: async (
			agentId: string,
			messages: any[],
			threadId?: string
		) => {
			try {
				const response = await fetch(
					`${API_BASE_URL}/api/agents/${agentId}/generate`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify({
							messages,
							threadId: threadId || undefined,
						}),
						mode: "cors",
						credentials: "omit",
					}
				);

				if (!response.ok) {
					throw new Error(`APIエラー: ${response.status}`);
				}

				return await response.json();
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
