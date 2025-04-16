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

	// チャンクを処理する関数
	const handleChunk = (chunk: string) => {
		// 現在のレスポンスに追加
		setCurrentResponse((prev) => prev + chunk);

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
		if (!message.trim()) return;

		// ユーザーメッセージをチャット履歴に追加
		const userMessage = { role: "user", content: message };
		setChatHistory((prev) => [...prev, userMessage]);

		// 入力欄をクリア
		setMessage("");

		// AIの応答用のプレースホルダーをチャット履歴に追加
		const aiResponsePlaceholder = { role: "assistant", content: "" };
		setChatHistory((prev) => [...prev, aiResponsePlaceholder]);

		// 現在のレスポンスをリセット
		setCurrentResponse("");

		try {
			// 送信するメッセージを準備
			const messages = [...chatHistory, userMessage].map((msg) => ({
				role: msg.role,
				content: msg.content,
			}));

			setIsLoading(true);

			// エージェントIDの確認
			if (!selectedAgent) {
				throw new Error("エージェントが選択されていません");
			}

			// Mastra APIにリクエストを送信（ストリーミングモード）
			await window.mastraAPI.streamMessageFromAgent(
				selectedAgent.id,
				messages,
				currentThreadId || undefined,
				handleChunk
			);
		} catch (error: any) {
			console.error("Error in sendMessage:", error);
			// エラーメッセージをチャット履歴に追加
			setChatHistory((prev) => {
				const newHistory = [...prev];
				if (newHistory.length > 0) {
					const lastMessage = newHistory[newHistory.length - 1];
					if (lastMessage.role === "assistant") {
						newHistory[newHistory.length - 1] = {
							...lastMessage,
							content:
								"エラーが発生しました: " +
								(error.message || "不明なエラー"),
						};
					}
				}
				return newHistory;
			});
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

	// 選択されたAgentが変更されたらスレッド一覧を読み込む
	useEffect(() => {
		if (selectedAgent) {
			// メモリ機能が未実装のため、スレッド一覧の取得はスキップ
			console.log(
				`Agent selected: ${selectedAgent.id}, skipping thread loading`
			);
			// loadThreads(selectedAgent.id); <- コメントアウトまたは削除
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

						{/* 会話履歴のリスト - メモリ機能が実装されていないので非表示 */}
						{/* <div className="space-y-1">
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
						</div> */}
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
									sendMessage()
								}
								disabled={isLoading || !selectedAgent}
							/>
							<Button
								onClick={sendMessage}
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
