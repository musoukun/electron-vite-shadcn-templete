import { useState, useEffect, useCallback, useRef } from "react";
import { Agent, Thread, ChatMessage } from "@/types/chat";
import { generateUserId, formatMessage } from "@/utils/chat-utils";

// ヘルパー関数: useChatLogic の前に配置
function isHtmlContent(content: string): boolean {
	if (!content) return false;
	const trimmedContent = content.trim();
	// 簡単なチェック: HTMLタグで始まるか、<html>, <body>タグを含むか
	return (
		(trimmedContent.startsWith("<") && trimmedContent.endsWith(">")) ||
		trimmedContent.includes("<html") ||
		trimmedContent.includes("<body")
	);
}

export function useChatLogic() {
	// フック内の isHtmlContent 定義は削除

	// 状態管理
	const [message, setMessage] = useState("");
	const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [streamError, setStreamError] = useState<string | null>(null);
	const [agents, setAgents] = useState<Agent[]>([]);
	const [isAgentsLoading, setIsAgentsLoading] = useState(false);
	const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
	const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
	const [threads, setThreads] = useState<Thread[]>([]);
	const [isThreadsLoading, setIsThreadsLoading] = useState(false);
	const [isAgentSelectionOpen, setIsAgentSelectionOpen] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [isArtifactOpen, setIsArtifactOpen] = useState(false);
	const [artifactContent, setArtifactContent] = useState<string | null>(null);

	// ユーザーID
	const userId = generateUserId();

	// スレッド一覧を読み込む
	const loadThreads = useCallback(
		async (agentId: string) => {
			if (!agentId) return;

			setIsThreadsLoading(true);
			try {
				// APIが利用可能かチェック
				if (!window.mastraAPI || !window.mastraAPI.getThreads) {
					console.error(
						"Error: window.mastraAPI.getThreads is undefined"
					);
					setThreads([]);
					return;
				}

				// ユーザーIDをリソースIDとして使用
				console.log(
					`Loading threads for agent: ${agentId}, resourceId: ${userId}`
				);
				const threadList = await window.mastraAPI.getThreads(
					agentId,
					userId
				);
				console.log("Thread list received:", threadList);

				if (!threadList || !Array.isArray(threadList)) {
					console.warn("API returned invalid thread list");
					setThreads([]);
					return;
				}

				setThreads(threadList);
			} catch (error) {
				console.error("Threadsの読み込みに失敗しました:", error);
				setThreads([]);
			} finally {
				setIsThreadsLoading(false);
			}
		},
		[userId]
	);

	// チャンクを処理する関数
	const handleChunk = useCallback((chunk: string) => {
		// チャット履歴の最後のメッセージを更新
		setChatHistory((prev) => {
			const newHistory = [...prev];
			if (newHistory.length > 0) {
				const lastMessage = newHistory[newHistory.length - 1];
				if (lastMessage.role === "assistant") {
					newHistory[newHistory.length - 1] = {
						...lastMessage,
						content: lastMessage.content + chunk,
					};
				}
			}
			return newHistory;
		});
	}, []);

	// AIのレスポンスが完了した時のイベントハンドラ
	const handleStreamComplete = useCallback(async () => {
		// 現在のスレッドIDと選択中のエージェントがある場合のみ処理
		if (currentThreadId && selectedAgent) {
			// 現在のスレッド情報を取得
			const currentThread = threads.find((t) => t.id === currentThreadId);

			// スレッド情報が存在し、かつタイトルが初期状態の場合のみ更新を試みる
			const initialTitlePattern = `${selectedAgent.name}との会話`; // 初期タイトルのパターン
			const isInitialTitle =
				currentThread && currentThread.title === initialTitlePattern;
			const isDefaultNewTitle =
				currentThread && currentThread.title === "新しい会話"; // デフォルトの新規タイトルもチェック

			if (currentThread && (isInitialTitle || isDefaultNewTitle)) {
				console.log(
					`スレッド ${currentThreadId} のタイトルが初期状態のため、更新を試みます。`
				);
				try {
					// チャット履歴からAIの最初の応答を取得 (システムメッセージは除く)
					const aiResponses = chatHistory.filter(
						(msg) => msg.role === "assistant"
					);

					if (aiResponses.length > 0) {
						// AIの最初の応答から先頭10文字を取得
						const firstAiResponseContent =
							aiResponses[0].content.trim(); // 前後の空白を除去
						const titleFromResponse =
							firstAiResponseContent.length > 10
								? `${firstAiResponseContent.substring(0, 10)}...`
								: firstAiResponseContent || "(空の応答)"; // 空の場合のフォールバック

						// スレッドタイトルを更新
						console.log(
							`スレッド ${currentThreadId} のタイトルを更新します: ${titleFromResponse}`
						);
						await window.mastraAPI.updateThreadTitle(
							currentThreadId,
							selectedAgent.id,
							titleFromResponse,
							userId
						);

						// スレッド一覧を更新（タイトル変更を反映するため）
						await loadThreads(selectedAgent.id);
					} else {
						console.log(
							"AIの応答が見つからないため、タイトルは更新しません。"
						);
					}
				} catch (error) {
					console.error("スレッドタイトル更新に失敗しました:", error);
				}
			} else {
				console.log(
					`スレッド ${currentThreadId} のタイトルは既に設定済みか、スレッドが見つかりません。タイトル更新はスキップします。`
				);
			}
		}

		// Artifactビューのロジック
		const lastMessage = chatHistory[chatHistory.length - 1];
		if (
			lastMessage &&
			lastMessage.role === "assistant" &&
			lastMessage.content
		) {
			if (isHtmlContent(lastMessage.content)) {
				console.log(
					"HTMLコンテンツを検出しました。Artifactビューを開きます。"
				);
				setArtifactContent(lastMessage.content);
				setIsArtifactOpen(true);
			}
		}
	}, [
		currentThreadId,
		selectedAgent,
		chatHistory,
		threads,
		userId,
		loadThreads,
		setArtifactContent,
		setIsArtifactOpen,
	]);

	// 利用可能なエージェントを読み込む
	const loadAgents = useCallback(async () => {
		setIsAgentsLoading(true);
		try {
			// mastraAPIが利用可能かチェック
			if (!window.mastraAPI) {
				console.error(
					"Error: window.mastraAPI is undefined in loadAgents"
				);
				setAgents([]);
				throw new Error(
					"API not available. Please restart the application."
				);
			}

			console.log("Calling window.mastraAPI.getAgents()...");
			const agentList = await window.mastraAPI.getAgents();
			console.log("Agent list received:", agentList);

			// APIからのレスポンスを確認
			if (!agentList || agentList.length === 0) {
				console.warn("API returned empty agent list");
				setAgents([]);
				return;
			}

			// 各エージェントのデータ構造を確認
			const validAgents = agentList
				.filter(
					(agent) => agent && typeof agent === "object" && agent.id
				)
				.map((agent) => ({
					id: agent.id,
					name: agent.name || agent.modelId || "名前なし",
					description: agent.instructions || agent.description || "",
				}));

			console.log("Valid agents:", validAgents);
			setAgents(validAgents);
		} catch (error) {
			console.error("Agentの読み込みに失敗しました:", error);
			// エラー処理
			setAgents([]); // エラー時は空の配列を設定
		} finally {
			setIsAgentsLoading(false);
		}
	}, []);

	// 新しいスレッドを作成
	const createNewThread = useCallback(
		async (agentId: string, title?: string) => {
			if (!agentId) return null;

			try {
				if (!window.mastraAPI || !window.mastraAPI.createThread) {
					console.error(
						"Error: window.mastraAPI.createThread is undefined"
					);
					return null;
				}

				console.log(
					`Creating new thread for agent: ${agentId}, resourceId: ${userId}`
				);
				const thread = await window.mastraAPI.createThread(
					agentId,
					title || "新しい会話",
					userId
				);
				console.log("New thread created:", thread);

				// スレッド一覧を更新
				await loadThreads(agentId);

				return thread;
			} catch (error) {
				console.error("スレッドの作成に失敗しました:", error);
				return null;
			}
		},
		[loadThreads, userId]
	);

	// スレッドを選択する関数
	const selectThread = useCallback(
		async (threadId: string) => {
			if (!threadId) return;

			try {
				setIsLoading(true);

				// スレッドのメッセージを取得
				if (!window.mastraAPI || !window.mastraAPI.getThreadMessages) {
					console.error(
						"Error: window.mastraAPI.getThreadMessages is undefined"
					);
					return;
				}

				// 選択されたスレッド情報から関連するエージェントを取得
				const selectedThread = threads.find((t) => t.id === threadId);
				if (!selectedThread) {
					console.error(
						`スレッド ID: ${threadId} は見つかりませんでした`
					);
					return;
				}

				// エージェントID取得
				let agentId = selectedThread.agentId || "";

				// スレッドに関連付けられたエージェント情報がない場合はエージェント一覧から取得
				if (!agentId) {
					console.warn(
						`スレッド ${threadId} にエージェントIDがありません、エージェント一覧から取得を試みます`
					);

					try {
						// エージェント一覧を取得
						const allAgents = await window.mastraAPI.getAgents();
						if (allAgents && allAgents.length > 0) {
							// 最初のエージェントをデフォルトとして使用
							agentId = allAgents[0].id;
							console.log(
								`最初のエージェントをデフォルトとして使用: ${agentId}`
							);
						}
					} catch (agentsError) {
						console.error(
							"エージェント一覧の取得に失敗:",
							agentsError
						);
					}

					// それでもエージェントIDが取得できない場合
					if (!agentId) {
						console.error(
							`エージェントIDを取得できません。会話の読み込みをキャンセルします。`
						);
						setChatHistory([
							{
								role: "system",
								content:
									"エージェント情報が見つかりません。新しい会話を開始するか、サポートにお問い合わせください。",
							},
						]);
						setIsLoading(false);
						return;
					}
				}

				// 現在選択中のエージェントが選択したスレッドのエージェントと異なる場合、エージェント情報を更新
				if (!selectedAgent || selectedAgent.id !== agentId) {
					try {
						console.log(`エージェント情報を取得します: ${agentId}`);
						const agentInfo =
							await window.mastraAPI.getAgentDetails(agentId);

						// エージェント情報を設定
						setSelectedAgent({
							id: agentId,
							name:
								selectedThread.agentName ||
								agentInfo.name ||
								"不明なエージェント",
							description:
								agentInfo.description ||
								agentInfo.instructions ||
								"",
						});

						console.log(
							`エージェント設定を更新しました: ${agentId}`
						);
					} catch (agentError) {
						console.error(
							`エージェント情報の取得に失敗しました: ${agentId}`,
							agentError
						);
						// エラーがあっても、暫定的なエージェント情報で続行
						setSelectedAgent({
							id: agentId,
							name:
								selectedThread.agentName ||
								"不明なエージェント",
							description: "",
						});
					}
				}

				console.log(
					`Getting messages for thread: ${threadId}, agent: ${agentId}, resourceId: ${userId}`
				);

				try {
					const messages = await window.mastraAPI.getThreadMessages(
						threadId,
						agentId,
						userId
					);
					console.log("Thread messages received:", messages);

					// メッセージの形式を確認するためのログ
					if (Array.isArray(messages) && messages.length > 0) {
						console.log(
							"最初のメッセージ:",
							JSON.stringify(messages[0])
						);
					}

					// チャット履歴を更新
					if (Array.isArray(messages) && messages.length > 0) {
						console.log(`メッセージ数: ${messages.length}`);

						// メッセージデータを適切に変換し、nullを除外
						const formattedMessages = messages
							.map(formatMessage)
							.filter((msg): msg is ChatMessage => msg !== null); // nullを除外するフィルター

						// 形式変換後のメッセージをログに出力
						console.log("変換後のメッセージ:", formattedMessages);

						setChatHistory([...formattedMessages]);
					} else {
						console.warn(
							"スレッドのメッセージが取得できないか空です:",
							messages
						);

						const agentName =
							selectedAgent?.name ||
							selectedThread.agentName ||
							"AI";
						// メッセージが取得できない場合は空のチャット履歴を設定
						setChatHistory([
							{
								role: "system",
								content: `${agentName}との会話を再開します。メッセージが見つかりませんでした。新しいメッセージを送信してください。`,
							},
						]);
					}
				} catch (error) {
					console.error("メッセージ取得中にエラー発生:", error);
					throw error;
				}

				// 現在のスレッドIDを設定
				setCurrentThreadId(threadId);
			} catch (error) {
				console.error("スレッドメッセージの取得に失敗しました:", error);
				if (error instanceof Error) {
					console.error("エラーの詳細:", error.message);
				}
				setChatHistory([
					{
						role: "system",
						content:
							"スレッドメッセージの取得に失敗しました。新しいメッセージで会話を開始してください。",
					},
				]);
			} finally {
				setIsLoading(false);
			}
		},
		[threads, selectedAgent, userId]
	);

	// スレッドを削除する関数
	const handleDeleteThread = useCallback(
		async (threadId: string) => {
			if (!threadId || !selectedAgent) return;

			console.log(`スレッド削除を開始: ${threadId}`);
			try {
				// APIを呼び出してスレッドを削除
				await window.mastraAPI.deleteThread(threadId, selectedAgent.id);
				console.log(`スレッド削除成功: ${threadId}`);

				// スレッドリストを再読み込み
				await loadThreads(selectedAgent.id);

				// 削除されたスレッドが現在選択中のスレッドだった場合、チャットをクリア
				if (currentThreadId === threadId) {
					setCurrentThreadId(null);
					setChatHistory([]);
					// 必要であれば、エージェント選択に戻るなどの処理を追加
					// setSelectedAgent(null);
				}
			} catch (error) {
				console.error(`スレッド削除に失敗: ${threadId}`, error);
				// 必要に応じてエラーメッセージをユーザーに表示
				setStreamError(
					`スレッドの削除に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`
				);
			}
		},
		[selectedAgent, currentThreadId, loadThreads] // 依存関係を追加
	);

	// 新しい会話を開始
	const startNewChat = useCallback(async () => {
		// 現在の会話をクリア
		setChatHistory([]);
		setCurrentThreadId(null);
		setStreamError(null);

		if (!selectedAgent) {
			console.error("Error: No agent selected to start a new chat.");
			// 必要であればユーザーにエージェント選択を促すメッセージを表示
			setChatHistory([
				{
					role: "system",
					content:
						"エラー: 会話を開始するエージェントが選択されていません。サイドバーからエージェントを選択してください。",
				},
			]);
			return;
		}

		// mastraAPIの存在チェック
		if (typeof window === "undefined" || !window.mastraAPI) {
			console.error("Error: window.mastraAPI is undefined");
			setChatHistory([
				{
					role: "system",
					content:
						"APIの初期化に失敗しました。アプリケーションを再起動してください。",
				},
			]);
			return;
		}

		// 選択中のエージェントで新しいスレッドを作成
		console.log(`Starting new chat with agent: ${selectedAgent.id}`);
		try {
			const initialTitle = `${selectedAgent.name}との新しい会話`;
			const thread = await createNewThread(
				selectedAgent.id,
				initialTitle
			);
			if (thread) {
				setCurrentThreadId(thread.id);
				setChatHistory([
					{
						role: "system",
						content: `${selectedAgent.name}との新しい会話を開始しました。メッセージを入力してください。`,
					},
				]);
			} else {
				console.error(
					"Failed to create new thread for the selected agent."
				);
				setChatHistory([
					{
						role: "system",
						content: "新しい会話の作成に失敗しました。",
					},
				]);
			}
		} catch (error) {
			console.error("Error starting new chat:", error);
			setChatHistory([
				{
					role: "system",
					content: `新しい会話の開始中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
				},
			]);
		}
	}, [selectedAgent, createNewThread]);

	// エージェントを選択したときの処理
	const handleAgentSelect = useCallback(
		async (agent: Agent) => {
			setSelectedAgent(agent);
			setIsAgentSelectionOpen(false);
			setStreamError(null);

			console.log(`Selected agent: ${agent.id} - ${agent.name}`);

			// エージェント用のスレッド一覧を読み込み
			await loadThreads(agent.id);

			try {
				// 新しいスレッドを作成してそれを使用
				const initialTitle = `${agent.name}との会話`;
				const thread = await createNewThread(agent.id, initialTitle);
				if (thread) {
					setCurrentThreadId(thread.id);

					// 空のチャット履歴を設定し、会話準備完了状態にする
					setChatHistory([
						{
							role: "system",
							content: `${agent.name}との新しい会話を開始しました。メッセージを入力してください。`,
						},
					]);
				} else {
					// スレッド作成に失敗した場合はスレッドIDなしで続行
					setCurrentThreadId(null);

					// 空のチャット履歴を設定し、会話準備完了状態にする
					setChatHistory([
						{
							role: "system",
							content: `${agent.name}との新しい会話を開始しました（メモリなし）。メッセージを入力してください。`,
						},
					]);
				}
			} catch (error) {
				console.error("スレッド作成に失敗しました:", error);

				// エラー時はスレッドIDなしで続行
				setCurrentThreadId(null);

				// 空のチャット履歴を設定し、会話準備完了状態にする
				setChatHistory([
					{
						role: "system",
						content: `${agent.name}との新しい会話を開始しました（メモリなし）。メッセージを入力してください。`,
					},
				]);
			}
		},
		[loadThreads, createNewThread]
	);

	// メッセージ送信処理
	const sendMessage = useCallback(async () => {
		if (!message.trim()) return;

		// エラー状態をリセット
		setStreamError(null);

		// 選択されているエージェントがない場合、利用可能なエージェントから最初のものを使用
		if (!selectedAgent) {
			try {
				// エージェントが読み込まれていない場合は読み込む
				if (agents.length === 0) {
					await loadAgents();
				}

				// エージェントが見つかった場合、最初のエージェントを選択
				if (agents.length > 0) {
					setSelectedAgent(agents[0]);
				} else {
					// エージェントが見つからない場合、エラーメッセージを表示して終了
					setStreamError(
						"エージェントが見つかりません。システム管理者に連絡してください。"
					);
					return;
				}
			} catch (error) {
				console.error("エージェントの読み込みに失敗しました:", error);
				setStreamError("エージェントの読み込みに失敗しました。");
				return;
			}
		}

		// ユーザーメッセージをチャット履歴に追加
		const userMessage: ChatMessage = {
			role: "user",
			content: message.trim(),
		};
		setChatHistory((prev) => [...prev, userMessage]);

		// 入力欄をクリア
		setMessage("");

		// AIの応答用のプレースホルダーをチャット履歴に追加
		const aiResponsePlaceholder: ChatMessage = {
			role: "assistant",
			content: "",
		};
		setChatHistory((prev) => [...prev, aiResponsePlaceholder]);

		setIsLoading(true);

		// 送信するメッセージを準備（システムメッセージは除外）
		const messagesToSend = chatHistory
			.filter((msg) => msg.role !== "system")
			.concat(userMessage)
			.map((msg) => ({
				role: msg.role,
				content: msg.content,
			}));

		console.log("Sending messages:", messagesToSend);

		// 使用するエージェントID
		const agentId = selectedAgent!.id;

		// 新しいスレッドを作成する場合、仮のタイトルを設定
		if (!currentThreadId) {
			// 仮のタイトルとしてユーザーメッセージから先頭10文字を取得
			const temporaryTitle =
				userMessage.content.length > 10
					? `${userMessage.content.substring(0, 10)}...`
					: userMessage.content;

			try {
				// スレッド作成に仮タイトルを使用
				const thread = await createNewThread(agentId, temporaryTitle);
				if (thread) {
					setCurrentThreadId(thread.id);
				}
			} catch (error) {
				console.error("新しいスレッドの作成に失敗しました:", error);
			}
		}

		try {
			// マストラAPIを使用してメッセージを送信（IPC版のストリーミングメソッド）
			await window.mastraAPI.streamMessageFromAgent(
				agentId,
				messagesToSend,
				currentThreadId || undefined,
				handleChunk,
				userId
			);

			// ストリーミング完了後、タイトル更新とArtifactビューのチェック
			await handleStreamComplete();
		} catch (error: any) {
			console.error("Error in sendMessage:", error);

			// エラーメッセージを保存
			setStreamError(error.message || "不明なエラーが発生しました");

			// エラーメッセージをチャット履歴に追加
			setChatHistory((prev) => {
				const newHistory = [...prev];
				if (newHistory.length > 0) {
					const lastMessage = newHistory[newHistory.length - 1];
					if (lastMessage.role === "assistant") {
						newHistory[newHistory.length - 1] = {
							...lastMessage,
							content: `エラーが発生しました: ${error.message || "不明なエラー"}\n\n再度メッセージを送信してください。`,
						};
					}
				}
				return newHistory;
			});

			// フォールバック処理を試す
			try {
				console.log("Trying fallback non-streaming API call...");
				// 非ストリーミングAPIを使用してメッセージを送信
				if (window.mastraAPI.sendMessageToAgent) {
					const response = await window.mastraAPI.sendMessageToAgent(
						agentId,
						messagesToSend,
						currentThreadId || undefined,
						userId
					);

					// 安全にレスポンステキストを抽出
					let responseContent = "";
					if (response) {
						if (typeof response === "string") {
							responseContent = response;
						} else if (response.response) {
							responseContent =
								typeof response.response === "string"
									? response.response
									: JSON.stringify(response.response);
						} else if (response.content) {
							responseContent =
								typeof response.content === "string"
									? response.content
									: JSON.stringify(response.content);
						}
					}

					if (responseContent) {
						// レスポンスが取得できた場合は表示する
						setChatHistory((prev) => {
							const newHistory = [...prev];
							if (newHistory.length > 0) {
								const lastMessage =
									newHistory[newHistory.length - 1];
								if (lastMessage.role === "assistant") {
									newHistory[newHistory.length - 1] = {
										...lastMessage,
										content: responseContent,
									};
								}
							}
							return newHistory;
						});

						console.log("Fallback API call succeeded");
						setStreamError(null);

						// フォールバックでも成功した場合、タイトル更新とArtifactビューのチェック
						if (isHtmlContent(responseContent)) {
							console.log(
								"HTMLコンテンツを検出しました (Fallback)。Artifactビューを開きます。"
							);
							setArtifactContent(responseContent);
							setIsArtifactOpen(true);
						}
					}
				}
			} catch (fallbackError) {
				console.error("Fallback API call also failed:", fallbackError);
				// フォールバックも失敗した場合は既に表示されているエラーメッセージを維持
			}
		} finally {
			setIsLoading(false);
		}
	}, [
		message,
		selectedAgent,
		chatHistory,
		currentThreadId,
		agents,
		loadAgents,
		createNewThread,
		handleChunk,
		userId,
		handleStreamComplete,
		setArtifactContent,
		setIsArtifactOpen,
	]);

	// マウント時にAPIの存在チェックとエージェント読み込みを行う
	useEffect(() => {
		// ロード時にAPIの存在をチェック
		console.log("App mounted, checking APIs availability");
		console.log("window.electronAPI available:", !!window.electronAPI);
		console.log("window.mastraAPI available:", !!window.mastraAPI);

		// mastraAPIの存在チェック
		if (typeof window === "undefined" || !window.mastraAPI) {
			console.error("Error: window.mastraAPI is undefined in useEffect");

			// フォールバック: _mastraAPIという名前でグローバルに設定されている可能性をチェック
			// @ts-ignore
			if (window._mastraAPI) {
				console.log("Found _mastraAPI, using as fallback");
				// @ts-ignore
				window.mastraAPI = window._mastraAPI;
				console.log("Fallback mastraAPI set:", !!window.mastraAPI);
				// フォールバックが成功した場合もエージェントを読み込む
				console.log(
					"mastraAPI (fallback) is available, loading agents..."
				);
				loadAgents();
				return;
			}

			// それでも見つからない場合はエラーメッセージを表示
			setChatHistory([
				{
					role: "system",
					content:
						"APIの初期化に失敗しました。アプリケーションを再起動してください。",
				},
			]);
			return;
		}

		// アプリ起動時にエージェント一覧のみを読み込む
		console.log("mastraAPI is available, loading agents...");
		loadAgents();

		// loadAllThreads(); // 起動時の全スレッド読み込みは削除
	}, [loadAgents]); // 依存配列から loadAllThreads を削除

	return {
		message,
		setMessage,
		chatHistory,
		setChatHistory,
		isLoading,
		setIsLoading,
		streamError,
		setStreamError,
		agents,
		setAgents,
		isAgentsLoading,
		selectedAgent,
		setSelectedAgent,
		currentThreadId,
		setCurrentThreadId,
		threads,
		setThreads,
		isThreadsLoading,
		isAgentSelectionOpen,
		setIsAgentSelectionOpen,
		messagesEndRef,
		userId,
		handleChunk,
		handleStreamComplete,
		loadAgents,
		loadThreads,
		createNewThread,
		startNewChat,
		handleAgentSelect,
		sendMessage,
		selectThread,
		handleDeleteThread,
		isArtifactOpen,
		setIsArtifactOpen,
		artifactContent,
		setArtifactContent,
	};
}
