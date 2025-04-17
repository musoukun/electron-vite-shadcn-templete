import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
	Send,
	Menu,
	User,
	Plus,
	MessageSquare,
	MoreHorizontal,
	Trash2,
	X,
} from "lucide-react";
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
import { Toaster } from "@/components/ui/toaster";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { AgentSelectionDialog } from "@/components/chat/AgentSelectionDialog";
import { ArtifactView } from "@/components/chat/ArtifactView";
import { useChatLogic } from "@/hooks/useChatLogic";
import { Agent, Thread, ChatMessage } from "@/types/chat";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// グローバルスコープに関数を公開するための型定義 (Preloadで公開したAPI)
declare global {
	interface Window {
		electronShell: {
			openExternalLink: (
				url: string
			) => Promise<{ success: boolean; error?: string }>;
		};
		// 他のAPI定義...
	}
}

// Agent選択ダイアログコンポーネント
function CustomAgentSelectionDialog({
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
	// useChatLogicからすべての必要な関数と状態を取得
	const {
		message,
		setMessage,
		chatHistory,
		setChatHistory,
		isLoading,
		streamError,
		agents,
		isAgentsLoading,
		selectedAgent,
		setSelectedAgent,
		currentThreadId,
		setCurrentThreadId,
		threads,
		isThreadsLoading,
		isAgentSelectionOpen,
		setIsAgentSelectionOpen,
		messagesEndRef,
		handleAgentSelect,
		startNewChat,
		sendMessage,
		selectThread,
		handleDeleteThread,
		isArtifactOpen,
		setIsArtifactOpen,
		artifactContent,
	} = useChatLogic();

	// メッセージが追加されたら自動スクロール
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [chatHistory]);

	// エージェント選択状態に戻す関数
	const handleBackToAgentSelection = () => {
		setSelectedAgent(null);
		setChatHistory([]);
		setCurrentThreadId(null);
	};

	// リンククリックハンドラ
	const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
		const link = event.currentTarget;
		const href = link.getAttribute("href");

		if (
			href &&
			(href.startsWith("http://") || href.startsWith("https://"))
		) {
			event.preventDefault(); // デフォルトの画面遷移をキャンセル
			console.log(`Opening external link: ${href}`);
			window.electronShell
				.openExternalLink(href)
				.then((result) => {
					if (!result.success) {
						console.error(
							"Failed to open external link:",
							result.error
						);
						// 必要に応じてユーザーにエラー通知
					}
				})
				.catch((error) => {
					console.error("Error calling openExternalLink:", error);
					// 必要に応じてユーザーにエラー通知
				});
		}
		// http/https以外のリンクはデフォルトの動作（もしあれば）
	};

	return (
		<SidebarProvider>
			<div className="flex h-screen w-full">
				<Sidebar className="w-64 border-r shrink-0">
					{/* サイドバーヘッダー */}
					<SidebarHeader className="p-4 border-b">
						<h2 className="text-lg font-semibold">
							{selectedAgent ? "会話履歴" : "エージェント選択"}
						</h2>
					</SidebarHeader>

					{/* サイドバーコンテンツ */}
					<SidebarContent className="flex-1 overflow-auto p-2">
						{!selectedAgent ? (
							// エージェント選択モード
							<div className="space-y-1">
								{isAgentsLoading ? (
									<div className="text-center p-4 text-sm text-muted-foreground">
										エージェント読み込み中...
									</div>
								) : agents.length > 0 ? (
									agents.map((agent) => (
										<Button
											key={agent.id}
											variant="ghost"
											className="w-full justify-start text-sm"
											onClick={() =>
												handleAgentSelect(agent)
											}
										>
											<User className="mr-2 h-4 w-4" />
											{agent.name || "名前なし"}
										</Button>
									))
								) : (
									<div className="text-center p-4 text-sm text-muted-foreground">
										利用可能なエージェントがありません。
									</div>
								)}
							</div>
						) : (
							// 会話モード
							<>
								{/* エージェント選択ボタン */}
								<Button
									variant="outline"
									className="w-full justify-start mb-2"
									onClick={handleBackToAgentSelection}
								>
									<User className="mr-2 h-4 w-4" />
									<span>他のエージェントを選択</span>
								</Button>

								{/* 新規チャットボタン */}
								<Button
									variant="default"
									className="w-full justify-start mb-2"
									onClick={startNewChat}
								>
									<Plus className="mr-2 h-4 w-4" />
									<span>新しい会話</span>
								</Button>

								{/* スレッド一覧 */}
								{isThreadsLoading ? (
									<div className="text-center p-4 text-sm text-muted-foreground">
										読み込み中...
									</div>
								) : threads.length > 0 ? (
									<div className="space-y-1">
										{threads.map((thread) => (
											<div
												key={thread.id}
												className="relative group"
											>
												<Button
													variant={
														currentThreadId ===
														thread.id
															? "secondary"
															: "ghost"
													}
													className="w-full justify-start text-sm pr-8"
													onClick={() =>
														selectThread(thread.id)
													}
												>
													<MessageSquare className="mr-2 h-4 w-4" />
													<div className="flex flex-col items-start overflow-hidden w-full">
														<span className="truncate w-full">
															{thread.title ||
																"無題の会話"}
														</span>
														{thread.agentName && (
															<span className="text-xs text-muted-foreground truncate w-full">
																{
																	thread.agentName
																}
															</span>
														)}
													</div>
												</Button>
												<DropdownMenu>
													<DropdownMenuTrigger
														asChild
													>
														<Button
															variant="ghost"
															size="icon"
															className="absolute top-1/2 right-1 transform -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
														>
															<MoreHorizontal className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={(e) => {
																e.stopPropagation();
																handleDeleteThread(
																	thread.id
																);
															}}
															className="text-red-600"
														>
															<Trash2 className="mr-2 h-4 w-4" />
															削除
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										))}
									</div>
								) : (
									<div className="text-center p-4 text-sm text-muted-foreground">
										会話履歴がありません
									</div>
								)}
							</>
						)}
					</SidebarContent>

					{/* アカウント情報 - エージェント選択時のみ表示 */}
					{selectedAgent && (
						<SidebarFooter className="p-4 border-t mt-auto">
							<div className="flex items-center gap-2">
								<div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
									<User size={16} />
								</div>
								<div>
									<p className="text-sm font-medium">
										{selectedAgent.name}
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
					)}
				</Sidebar>

				<ResizablePanelGroup direction="horizontal" className="flex-1">
					<ResizablePanel
						defaultSize={isArtifactOpen ? 50 : 100}
						minSize={30}
					>
						<div className="flex-1 flex flex-col w-full h-full overflow-hidden">
							<div className="p-4 border-b flex items-center shrink-0">
								<SidebarTrigger>
									<Button
										variant="ghost"
										size="icon"
										className="mr-2 lg:hidden"
									>
										<Menu className="h-5 w-5" />
									</Button>
								</SidebarTrigger>
								<h1 className="text-xl font-bold">
									{selectedAgent
										? selectedAgent.name
										: "エージェントを選択"}
								</h1>
							</div>

							<div className="flex-1 p-4 overflow-auto">
								<div className="space-y-4 max-w-4xl mx-auto">
									{!selectedAgent ? (
										<div className="text-center text-muted-foreground py-8">
											サイドバーからエージェントを選択して会話を開始してください。
										</div>
									) : chatHistory.length === 0 &&
									  !isLoading ? (
										<div className="text-center text-muted-foreground py-8">
											メッセージを送信して会話を開始してください。
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
															: chat.role ===
																  "assistant"
																? selectedAgent?.name ||
																	"AI"
																: "システム"}
													</CardTitle>
												</CardHeader>
												<CardContent className="py-2 prose dark:prose-invert max-w-none">
													<ReactMarkdown
														remarkPlugins={[
															remarkGfm,
														]}
														components={{
															// aタグのレンダリングをカスタマイズ
															a: ({
																node,
																...props
															}) => (
																<a
																	{...props}
																	onClick={
																		handleLinkClick
																	}
																	target="_blank"
																	rel="noopener noreferrer"
																/>
															),
														}}
													>
														{chat.content}
													</ReactMarkdown>
													{isLoading &&
														index ===
															chatHistory.length -
																1 &&
														chat.role ===
															"assistant" && (
															<span className="animate-pulse">
																▌
															</span>
														)}
												</CardContent>
											</Card>
										))
									)}
									<div ref={messagesEndRef}></div>
								</div>
							</div>

							{streamError && (
								<div className="p-2 bg-red-50 border-t border-red-200 text-red-700 text-sm">
									<p>エラーが発生しました: {streamError}</p>
								</div>
							)}

							{selectedAgent && (
								<div className="p-4 border-t">
									<div className="flex gap-2 max-w-4xl mx-auto items-end">
										<Textarea
											value={message}
											onChange={(e) =>
												setMessage(e.target.value)
											}
											placeholder="メッセージを入力 (Shift+Enterで改行)..."
											className="min-h-[60px] max-h-[200px] resize-none"
											rows={1}
											onKeyDown={(e) => {
												if (
													e.key === "Enter" &&
													!e.shiftKey
												) {
													e.preventDefault();
													sendMessage();
												}
											}}
											disabled={isLoading}
										/>
										<Button
											onClick={sendMessage}
											disabled={
												isLoading || !message.trim()
											}
											className="self-end mb-[5px]"
										>
											{isLoading ? (
												"送信中..."
											) : (
												<Send className="h-4 w-4" />
											)}
										</Button>
									</div>
								</div>
							)}
						</div>
					</ResizablePanel>

					{isArtifactOpen && (
						<>
							<ResizableHandle withHandle />
							<ResizablePanel defaultSize={50} minSize={20}>
								<ArtifactView
									isOpen={isArtifactOpen}
									content={artifactContent}
									onClose={() => setIsArtifactOpen(false)}
								/>
							</ResizablePanel>
						</>
					)}
				</ResizablePanelGroup>
			</div>

			<CustomAgentSelectionDialog
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
