import { useState, useEffect } from "react";
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
										{agent.name}
									</span>
									{agent.description && (
										<span className="text-sm text-muted-foreground truncate">
											{agent.description}
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
	const [chatHistory, setChatHistory] = useState<
		{ role: string; content: string }[]
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [currentResponse, setCurrentResponse] = useState(""); // ストリーミング中のレスポンス
	const [agents, setAgents] = useState<Agent[]>([]);
	const [isAgentsLoading, setIsAgentsLoading] = useState(false);
	const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
	const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
	const [threads, setThreads] = useState<Thread[]>([]);
	const [isThreadsLoading, setIsThreadsLoading] = useState(false);
	const [isAgentSelectionOpen, setIsAgentSelectionOpen] = useState(false);

	// 利用可能なエージェントを読み込む
	const loadAgents = async () => {
		setIsAgentsLoading(true);
		try {
			const agentList = await window.mastraAPI.getAgents();
			// APIからのレスポンスが配列であることを確認
			setAgents(Array.isArray(agentList) ? agentList : []);
		} catch (error) {
			console.error("Agentの読み込みに失敗しました:", error);
			// エラー処理（例：通知を表示するなど）
			setAgents([]); // エラー時は空の配列を設定
		} finally {
			setIsAgentsLoading(false);
		}
	};

	// スレッド一覧を読み込む
	const loadThreads = async (agentId: string) => {
		if (!agentId) return;

		setIsThreadsLoading(true);
		try {
			const threadList = await window.mastraAPI.getThreads(agentId);
			setThreads(Array.isArray(threadList) ? threadList : []);
		} catch (error) {
			console.error("スレッド一覧の読み込みに失敗しました:", error);
			setThreads([]);
		} finally {
			setIsThreadsLoading(false);
		}
	};

	// スレッドのメッセージを読み込む
	const loadThreadMessages = async (threadId: string, agentId: string) => {
		if (!threadId || !agentId) return;

		setIsLoading(true);
		try {
			const messages = await window.mastraAPI.getThreadMessages(
				threadId,
				agentId
			);
			setChatHistory(messages);
		} catch (error) {
			console.error("スレッドメッセージの読み込みに失敗しました:", error);
		} finally {
			setIsLoading(false);
		}
	};

	// 新しい会話を開始
	const startNewChat = () => {
		// 現在の会話をクリア
		setChatHistory([]);
		setCurrentThreadId(null);

		// エージェント選択ダイアログを開く
		setIsAgentSelectionOpen(true);
	};

	// エージェントを選択したときの処理
	const handleAgentSelect = async (agent: Agent) => {
		setSelectedAgent(agent);
		setIsAgentSelectionOpen(false);

		// 新しいスレッドを作成
		try {
			const thread = await window.mastraAPI.createThread(
				agent.id,
				"新しい会話"
			);
			setCurrentThreadId(thread.id);

			// スレッド一覧を更新
			await loadThreads(agent.id);
		} catch (error) {
			console.error("新しいスレッドの作成に失敗しました:", error);
		}
	};

	// スレッドを選択したときの処理
	const handleThreadSelect = async (thread: Thread) => {
		setCurrentThreadId(thread.id);
		if (selectedAgent) {
			await loadThreadMessages(thread.id, selectedAgent.id);
		}
	};

	// メッセージ送信処理（ストリーミング対応版）
	const handleSendMessage = async () => {
		if (!message.trim() || isLoading || !selectedAgent) return;

		setIsLoading(true);

		// ユーザーメッセージをチャット履歴に追加
		const userMessage = { role: "user", content: message };
		setChatHistory((prev) => [...prev, userMessage]);

		// 入力フィールドをクリア
		setMessage("");

		try {
			// スレッドがなければ作成
			if (!currentThreadId && selectedAgent) {
				const thread = await window.mastraAPI.createThread(
					selectedAgent.id,
					"新しい会話"
				);
				setCurrentThreadId(thread.id);
			}

			// AIの応答用の空のメッセージを追加
			setCurrentResponse("");
			setChatHistory((prev) => [
				...prev,
				{ role: "assistant", content: "" },
			]);

			// メッセージをAPIに送信（ストリーミング）
			const messages = [...chatHistory, userMessage];

			// チャンクごとの処理を定義
			const handleChunk = (chunk: string) => {
				try {
					// SSEの場合、データは「data: {json}」の形式で送られてくるので解析
					if (chunk.startsWith("data:")) {
						const jsonStr = chunk.substring(5).trim();
						if (jsonStr) {
							try {
								const data = JSON.parse(jsonStr);
								if (data.text || data.content || data.delta) {
									const newText =
										data.text ||
										data.content ||
										data.delta ||
										"";
									setCurrentResponse(
										(prev) => prev + newText
									);

									// 最新のレスポンスでチャット履歴を更新
									setChatHistory((prev) => {
										const newHistory = [...prev];
										newHistory[newHistory.length - 1] = {
											...newHistory[
												newHistory.length - 1
											],
											content:
												prev[prev.length - 1].content +
												newText,
										};
										return newHistory;
									});
								}
							} catch (e) {
								// JSON解析エラーの場合はテキストとして処理
								setCurrentResponse((prev) => prev + chunk);

								// 最新のレスポンスでチャット履歴を更新
								setChatHistory((prev) => {
									const newHistory = [...prev];
									newHistory[newHistory.length - 1] = {
										...newHistory[newHistory.length - 1],
										content:
											prev[prev.length - 1].content +
											chunk,
									};
									return newHistory;
								});
							}
						}
					} else {
						// 通常のテキストチャンク
						setCurrentResponse((prev) => prev + chunk);

						// 最新のレスポンスでチャット履歴を更新
						setChatHistory((prev) => {
							const newHistory = [...prev];
							newHistory[newHistory.length - 1] = {
								...newHistory[newHistory.length - 1],
								content: prev[prev.length - 1].content + chunk,
							};
							return newHistory;
						});
					}
				} catch (error) {
					console.error(
						"チャンクの処理中にエラーが発生しました:",
						error
					);
				}
			};

			// ストリーミングAPIを呼び出し
			if (selectedAgent && currentThreadId) {
				await window.mastraAPI.streamMessageFromAgent(
					selectedAgent.id,
					messages,
					currentThreadId,
					handleChunk
				);

				// スレッド一覧を更新
				await loadThreads(selectedAgent.id);
			}
		} catch (error) {
			console.error("メッセージの送信中にエラーが発生しました:", error);

			// エラーメッセージをチャット履歴に追加
			const errorMessage = {
				role: "system",
				content:
					"エラーが発生しました。しばらくしてからもう一度お試しください。",
			};
			setChatHistory((prev) => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
			setCurrentResponse("");
		}
	};

	// マウント時にAgentを読み込む
	useEffect(() => {
		loadAgents();
	}, []);

	// 選択されたAgentが変更されたらスレッド一覧を読み込む
	useEffect(() => {
		if (selectedAgent) {
			loadThreads(selectedAgent.id);
		}
	}, [selectedAgent]);

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

						{/* 会話履歴のリスト */}
						<div className="space-y-1">
							{isThreadsLoading ? (
								<div className="text-center py-2 text-sm text-muted-foreground">
									読み込み中...
								</div>
							) : threads.length === 0 ? (
								<div className="text-center py-2 text-sm text-muted-foreground">
									会話履歴がありません
								</div>
							) : (
								threads.map((thread) => (
									<Button
										key={thread.id}
										variant="ghost"
										className={`w-full justify-start text-sm ${
											currentThreadId === thread.id
												? "bg-muted"
												: ""
										}`}
										onClick={() =>
											handleThreadSelect(thread)
										}
									>
										<MessageSquare className="mr-2 h-4 w-4" />
										<span className="truncate">
											{thread.title}
										</span>
									</Button>
								))
							)}
						</div>
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
										<CardContent className="py-2">
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
						</div>
					</div>

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
									handleSendMessage()
								}
								disabled={isLoading || !selectedAgent}
							/>
							<Button
								onClick={handleSendMessage}
								disabled={isLoading || !selectedAgent}
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
