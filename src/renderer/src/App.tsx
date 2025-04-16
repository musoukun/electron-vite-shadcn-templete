import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Send, Menu, User, Plus, MessageSquare } from "lucide-react";
import {
	Sidebar,
	SidebarProvider,
	SidebarTrigger,
	SidebarContent,
	SidebarHeader,
	SidebarFooter,
} from "@/components/ui/sidebar";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";

// Agentの型定義
interface Agent {
	id: string;
	name: string;
	description?: string;
}

// スレッドの型定義
interface Thread {
	id: string;
	title: string;
}

// メッセージの型定義
interface ChatMessage {
	role: string;
	content: string;
	id?: string;
	createdAt?: string;
}

// Agent選択ダイアログコンポーネント
function AgentSelectionDialog({
	open,
	onOpenChange,
	onSelect,
	agents,
	isLoading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (agent: Agent) => void;
	agents: Agent[];
	isLoading: boolean;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Agentを選択</DialogTitle>
					<DialogDescription>
						会話を始めるAgentを選択してください
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-2 py-4 max-h-[300px] overflow-y-auto">
					{isLoading ? (
						<div className="text-center p-4">読み込み中...</div>
					) : agents.length === 0 ? (
						<div className="text-center p-4">
							Agentが見つかりませんでした
						</div>
					) : (
						agents.map((agent) => (
							<Button
								key={agent.id}
								variant="outline"
								className="w-full justify-start text-left p-4"
								onClick={() => onSelect(agent)}
							>
								<div className="flex flex-col">
									<span className="font-semibold">
										{agent.name || "名前なし"}
									</span>
									{agent.description && (
										<span className="text-sm text-muted-foreground truncate">
											{agent.description.substring(
												0,
												100
											)}
											{agent.description.length > 100 &&
												"..."}
										</span>
									)}
								</div>
							</Button>
						))
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						キャンセル
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function App() {
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

	// メッセージが追加されたら自動スクロール
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [chatHistory]);

	// チャンクを処理する関数
	const handleChunk = (chunk: string) => {
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
	};

	// 利用可能なエージェントを読み込む
	const loadAgents = async () => {
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
			// エラー処理（例：通知を表示するなど）
			setAgents([]); // エラー時は空の配列を設定
		} finally {
			setIsAgentsLoading(false);
		}
	};

	// 新しい会話を開始
	const startNewChat = () => {
		// 現在の会話をクリア
		setChatHistory([]);
		setCurrentThreadId(null);
		setStreamError(null);

		// mastraAPIの存在チェック
		if (typeof window === "undefined" || !window.mastraAPI) {
			console.error("Error: window.mastraAPI is undefined");
			// エラーメッセージを表示
			setChatHistory([
				{
					role: "system",
					content:
						"APIの初期化に失敗しました。アプリケーションを再起動してください。",
				},
			]);
			return;
		}

		// ボタンクリック時にエージェント一覧を読み込む
		console.log("Loading agents for new chat...");
		loadAgents();

		// エージェント選択ダイアログを開く
		setIsAgentSelectionOpen(true);
	};

	// エージェントを選択したときの処理
	const handleAgentSelect = async (agent: Agent) => {
		setSelectedAgent(agent);
		setIsAgentSelectionOpen(false);
		setStreamError(null);

		// スレッド作成処理をスキップ - メモリ機能が未実装のため
		console.log(`Selected agent: ${agent.id} - ${agent.name}`);

		// 空のチャット履歴を設定し、会話準備完了状態にする
		setChatHistory([
			{
				role: "system",
				content: `${agent.name}との新しい会話を開始しました。メッセージを入力してください。`,
			},
		]);

		// スレッドIDは使用しない（null）
		setCurrentThreadId(null);
	};

	// メッセージ送信処理
	const sendMessage = async () => {
		if (!message.trim() || !selectedAgent) return;

		// エラー状態をリセット
		setStreamError(null);

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

		try {
			// マストラAPIを使用してメッセージを送信（IPC版のストリーミングメソッド）
			await window.mastraAPI.streamMessageFromAgent(
				selectedAgent.id,
				messagesToSend,
				currentThreadId || undefined,
				handleChunk
			);
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
						selectedAgent.id,
						messagesToSend,
						currentThreadId || undefined
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
					}
				}
			} catch (fallbackError) {
				console.error("Fallback API call also failed:", fallbackError);
				// フォールバックも失敗した場合は既に表示されているエラーメッセージを維持
			}
		} finally {
			setIsLoading(false);
		}
	};

	// マウント時にAPIの存在チェックを行う
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

		// 最初のロード時には読み込まない
		// console.log("mastraAPI is available, loading agents...");
		// loadAgents();
	}, []);

	return (
		<SidebarProvider>
			<div className="flex h-screen w-full">
				<Sidebar className="w-64 border-r shrink-0">
					{/* サイドバーのコンテンツ */}
					<SidebarHeader className="p-4 border-b">
						<h2 className="text-lg font-semibold">会話履歴</h2>
					</SidebarHeader>

					<SidebarContent className="flex-1 overflow-auto p-2">
						{/* 新規チャットボタン */}
						<Button
							variant="default"
							className="w-full justify-start mb-2"
							onClick={startNewChat}
						>
							<Plus className="mr-2 h-4 w-4" />
							<span>新しい会話</span>
						</Button>
					</SidebarContent>

					{/* アカウント情報 */}
					<SidebarFooter className="p-4 border-t mt-auto">
						<div className="flex items-center gap-2">
							<div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
								<User size={16} />
							</div>
							<div>
								<p className="text-sm font-medium">
									{selectedAgent
										? selectedAgent.name
										: "Agent未選択"}
								</p>
								<p className="text-xs text-muted-foreground">
									{selectedAgent?.description
										? selectedAgent.description.substring(
												0,
												30
											) + "..."
										: "Mastra API"}
								</p>
							</div>
						</div>
					</SidebarFooter>
				</Sidebar>

				<div className="flex-1 flex flex-col w-full overflow-hidden">
					<div className="p-4 border-b flex items-center">
						<SidebarTrigger>
							<Button
								variant="ghost"
								size="icon"
								className="mr-2"
							>
								<Menu className="h-5 w-5" />
							</Button>
						</SidebarTrigger>
						<h1 className="text-xl font-bold">
							{selectedAgent
								? selectedAgent.name
								: "LLMクライアント"}
						</h1>
					</div>

					<div className="flex-1 p-4 overflow-auto">
						<div className="space-y-4 max-w-4xl mx-auto">
							{!selectedAgent ? (
								<div className="text-center text-muted-foreground py-8">
									左サイドバーの「新しい会話」ボタンを押して、会話を開始してください
								</div>
							) : chatHistory.length === 0 ? (
								<div className="text-center text-muted-foreground py-8">
									メッセージを送信して会話を開始してください
								</div>
							) : (
								chatHistory.map((chat, index) => (
									<Card
										key={index}
										className={`${
											chat.role === "user"
												? "bg-muted"
												: ""
										}`}
									>
										<CardHeader className="py-2">
											<CardTitle className="text-sm">
												{chat.role === "user"
													? "あなた"
													: chat.role === "assistant"
														? selectedAgent?.name ||
															"AI"
														: "システム"}
											</CardTitle>
										</CardHeader>
										<CardContent className="py-2 whitespace-pre-wrap">
											{chat.content}
											{isLoading &&
												index ===
													chatHistory.length - 1 &&
												chat.role === "assistant" && (
													<span className="animate-pulse">
														▌
													</span>
												)}
										</CardContent>
									</Card>
								))
							)}
							{/* 自動スクロール用の参照 */}
							<div ref={messagesEndRef}></div>
						</div>
					</div>

					{/* エラーメッセージの表示 */}
					{streamError && (
						<div className="p-2 bg-red-50 border-t border-red-200 text-red-700 text-sm">
							<p>エラーが発生しました: {streamError}</p>
						</div>
					)}

					<div className="p-4 border-t">
						<div className="flex gap-2 max-w-4xl mx-auto">
							<Input
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								placeholder={
									selectedAgent
										? "メッセージを入力..."
										: "会話を開始するにはAgentを選択してください"
								}
								onKeyDown={(e) =>
									e.key === "Enter" &&
									!e.shiftKey &&
									sendMessage()
								}
								disabled={isLoading || !selectedAgent}
							/>
							<Button
								onClick={sendMessage}
								disabled={
									isLoading ||
									!selectedAgent ||
									!message.trim()
								}
							>
								{isLoading ? (
									"送信中..."
								) : (
									<Send className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Agent選択ダイアログ */}
			<AgentSelectionDialog
				open={isAgentSelectionOpen}
				onOpenChange={setIsAgentSelectionOpen}
				onSelect={handleAgentSelect}
				agents={agents}
				isLoading={isAgentsLoading}
			/>
		</SidebarProvider>
	);
}

export default App;
