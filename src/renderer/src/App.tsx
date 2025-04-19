import React, { useEffect } from "react";
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
	LayoutGrid,
} from "lucide-react";
import {
	Sidebar,
	SidebarProvider,
	SidebarTrigger,
	SidebarContent,
	SidebarHeader,
	SidebarFooter,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlight } from "remark-sugar-high";
import { useChatLogic } from "@/hooks/useChatLogic";
import { ArtifactViewer } from "@/components/artifacts";
import { extractHtmlBlock, extractMarkdownBlock } from "@/utils/artifact-utils";
import { ArtifactType } from "@/types/artifact";
import { CustomAgentSelectionDialog } from "@/components/dialogs";
import { ChatMessage } from "@/types/chat";

// グローバルスコープに関数を公開するための型定義 (Preloadで公開したAPI)
declare global {
	interface Window {
		electronShell: {
			openExternalLink: (
				url: string
			) => Promise<{ success: boolean; error?: string }>;
		};
	}
}

function AppContent() {
	// useChatLogicからすべての必要な関数と状態を取得
	const {
		isLoading,
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
		setArtifactContent,
		artifactType,
		setArtifactType,
		messages,
		error,
		input,
		handleInputChange,
	} = useChatLogic();

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

	// ReactMarkdown 用のカスタムコンポーネント定義
	const markdownComponents = {
		// リンクの処理
		a: ({ node, ...props }: any) => (
			<a
				{...props}
				onClick={handleLinkClick}
				target="_blank"
				rel="noopener noreferrer"
			/>
		),
		// コードブロックの処理をカスタマイズ
		code: ({ node, inline, className, children, ...props }: any) => {
			const match = /language-(\w+)/.exec(className || "");
			const lang = match && match[1] ? match[1].toLowerCase() : "";

			// オブジェクトの適切な文字列変換処理
			// children がReact要素の配列の場合の特別処理
			let content = "";

			if (Array.isArray(children)) {
				console.log(
					"【配列検出】React要素の配列を処理します:",
					children.length,
					"個の要素"
				);

				// 要素の配列を適切に処理
				try {
					// React要素から実際のテキスト内容を抽出
					content = children
						.map((child) => {
							// React要素からテキスト抽出を試みる
							if (typeof child === "string") {
								return child;
							} else if (child && typeof child === "object") {
								// propsからchildren（テキスト）を取得
								if (child.props && child.props.children) {
									if (
										typeof child.props.children === "string"
									) {
										return child.props.children;
									} else if (
										Array.isArray(child.props.children)
									) {
										// さらに再帰的に処理
										return child.props.children
											.map((c: any) =>
												typeof c === "string" ? c : ""
											)
											.join("");
									}
								}
								// JSONとしてオブジェクトの構造を表示
								return JSON.stringify(
									child,
									(key, value) => {
										// Symbol値やReact特殊オブジェクトを文字列化
										if (typeof value === "symbol")
											return value.toString();
										// 循環参照防止
										if (
											key === "_owner" ||
											key === "_store"
										)
											return undefined;
										return value;
									},
									2
								);
							}
							return "";
						})
						.join("");
				} catch (e) {
					console.error("React要素の処理中にエラー:", e);
					content = String(children);
				}
			} else {
				// 通常の文字列処理
				content = String(children).replace(/\n$/, "");
			}

			// [object Object] の問題を修正 - JSON形式でフォーマットして表示
			if (content.includes("[object Object]")) {
				try {
					// 正規表現を使ってすべての [object Object] パターンを探す
					// そのままの文字列だけでなく、周囲のコンテキストを取得して解析を試みる
					content = content.replace(
						/(\{[^{}]*\[object Object\][^{}]*\}|\[object Object\])/g,
						(match) => {
							console.log("オブジェクト文字列検出:", match);

							// シンプルな [object Object] だけの場合
							if (match === "[object Object]") {
								return "{ 不明なオブジェクト }";
							}

							// 何らかの構造を持つオブジェクトの場合、可能な限りパース
							try {
								// プロパティ名のパターンを探す
								const propPattern =
									/(\w+)\s*:\s*\[object Object\]/g;
								let foundProps = false;
								const parsedObj = match.replace(
									propPattern,
									(propMatch, propName) => {
										foundProps = true;
										return `"${propName}": { "type": "オブジェクト" }`;
									}
								);

								// プロパティが見つかった場合、整形して表示
								if (foundProps) {
									// 整形して見やすくする
									const formatted = parsedObj
										.replace(
											/\[object Object\]/g,
											'{ "type": "オブジェクト" }'
										)
										.replace(/'/g, '"')
										.replace(/(\w+):/g, '"$1":');

									try {
										// 可能ならJSONとしてパースして整形
										const jsonObj = JSON.parse(formatted);
										return JSON.stringify(jsonObj, null, 2);
									} catch (e) {
										// JSONパースに失敗した場合はそのまま返す
										return formatted;
									}
								}

								return "{ 構造不明のオブジェクト }";
							} catch (e) {
								console.error(
									"オブジェクト構造の解析に失敗:",
									e
								);
								return "{ パース不能なオブジェクト }";
							}
						}
					);
				} catch (e) {
					console.error("オブジェクト変換エラー:", e);
				}
			}

			// 1. 言語が 'markdown' の場合 -> 再度 ReactMarkdown でレンダリング
			if (lang === "markdown") {
				return (
					<div className="nested-markdown-block rounded-lg bg-muted/50 p-4 my-4 border border-muted-foreground/20">
						<ReactMarkdown
							remarkPlugins={[remarkGfm, highlight]}
							components={{ a: markdownComponents.a }}
						>
							{content.trim() || ""}
						</ReactMarkdown>
					</div>
				);
			}

			// 2. インラインコードの場合
			if (inline) {
				return (
					<code className={className} {...props}>
						{content}
					</code>
				);
			}

			// 3. 通常のコードブロックの場合 (markdown 以外 or 言語指定なし)
			return (
				<div className="relative code-block-wrapper w-full">
					{lang && (
						<div className="absolute top-2 right-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
							{lang}
						</div>
					)}
					{/* オーバーフロー問題を修正するためのスタイル追加 */}
					<pre
						className={`${className || ""} syntax-highlighted rounded-md p-4 my-2 overflow-x-auto w-full whitespace-pre-wrap break-words`}
					>
						<code {...props} className={`${className} break-words`}>
							{content}
						</code>
					</pre>
				</div>
			);
		},
	};

	// メッセージが追加されたら自動スクロール
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages]);

	// チャット履歴に新しいメッセージが追加されたときに、コードブロックがあれば自動的にArtifactとして抽出
	useEffect(() => {
		if (messages.length === 0) return;

		// 最後のメッセージを取得
		const lastMessage = messages[messages.length - 1];

		// AIのメッセージからコードブロックまたはマークダウンを抽出
		if (lastMessage && lastMessage.role === "assistant" && !isLoading) {
			console.log(
				"マークダウン抽出チェック: メッセージ長さ =",
				lastMessage.content.length
			);

			// まず、コンテンツ自体がマークダウンとして意味があるか確認
			const hasMarkdownStructure =
				/(^|\n)#{1,6}\s+.+/m.test(lastMessage.content) && // 見出し
				lastMessage.content.split("\n").length > 5; // 少なくとも数行ある

			if (hasMarkdownStructure) {
				console.log("メッセージ全体がマークダウン構造を持っています");
				setArtifactContent(lastMessage.content);
				setArtifactType("markdown");
				setIsArtifactOpen(true);
				return;
			}

			// HTMLブロックを探す
			const htmlContent = extractHtmlBlock(lastMessage.content);
			if (htmlContent) {
				console.log("HTMLブロック検出: 長さ =", htmlContent.length);
				setArtifactContent(htmlContent);
				setArtifactType("html");
				setIsArtifactOpen(true);
				return;
			}

			// マークダウンブロックを探す
			const markdownContent = extractMarkdownBlock(lastMessage.content);
			if (markdownContent) {
				console.log(
					"マークダウンブロック検出: 長さ =",
					markdownContent.length
				);
				setArtifactContent(markdownContent);
				setArtifactType("markdown");
				setIsArtifactOpen(true);
				return;
			}
		}
	}, [
		messages,
		isLoading,
		setArtifactContent,
		setIsArtifactOpen,
		setArtifactType,
	]);

	// エージェント選択状態に戻す関数
	const handleBackToAgentSelection = () => {
		setSelectedAgent(null);
		// 新しいエージェントを選択する際にメッセージはリセットされる
		setCurrentThreadId(null);
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
							<>
								<Button
									variant="outline"
									className="w-full justify-start mb-2"
									onClick={handleBackToAgentSelection}
								>
									<User className="mr-2 h-4 w-4" />
									<span>他のエージェントを選択</span>
								</Button>

								<Button
									variant="default"
									className="w-full justify-start mb-2"
									onClick={startNewChat}
								>
									<Plus className="mr-2 h-4 w-4" />
									<span>新しい会話</span>
								</Button>

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
									) : messages.length === 0 && !isLoading ? (
										<div className="text-center text-muted-foreground py-8">
											メッセージを送信して会話を開始してください。
										</div>
									) : (
										messages.map(
											(
												chat: ChatMessage,
												index: number
											) => {
												let previewContent:
													| string
													| null = null;
												let previewType: ArtifactType | null =
													null;

												const htmlContent =
													extractHtmlBlock(
														chat.content
													);
												if (htmlContent) {
													previewContent =
														htmlContent;
													previewType = "html";
												} else {
													const markdownContent =
														extractMarkdownBlock(
															chat.content
														);
													if (markdownContent) {
														previewContent =
															markdownContent;
														previewType =
															"markdown";
													}
												}

												return (
													<Card
														key={index}
														className={`relative group ${chat.role === "user" ? "bg-muted" : ""}`}
													>
														<CardHeader className="py-2">
															<CardTitle className="text-sm">
																{chat.role ===
																"user"
																	? "あなた"
																	: chat.role ===
																		  "assistant"
																		? selectedAgent?.name ||
																			"AI"
																		: "システム"}
															</CardTitle>
														</CardHeader>
														<CardContent className="py-2 prose dark:prose-invert max-w-none whitespace-pre-wrap break-words overflow-x-auto">
															{/* MarkdownWithNestedCodeBlocks の代わりに ReactMarkdown を直接使用 */}
															<div className="w-full overflow-hidden break-words">
																<ReactMarkdown
																	remarkPlugins={[
																		remarkGfm,
																		highlight,
																	]}
																	components={
																		markdownComponents
																	}
																>
																	{chat.content ||
																		""}
																</ReactMarkdown>
															</div>
															{isLoading &&
																index ===
																	messages.length -
																		1 &&
																chat.role ===
																	"assistant" && (
																	<span className="animate-pulse">
																		▌
																	</span>
																)}
														</CardContent>

														{previewContent &&
															previewType && (
																<Button
																	variant="ghost"
																	size="icon"
																	className="absolute bottom-1 right-1 h-7 w-7 opacity-50 group-hover:opacity-100 focus:opacity-100"
																	title={`${previewType === "html" ? "HTML" : "Markdown"} プレビュー表示`}
																	onClick={() => {
																		console.log(
																			`プレビューボタン (${previewType}): コンテンツをセットしてArtifactを開く`
																		);
																		setArtifactContent(
																			previewContent
																		);
																		setArtifactType(
																			previewType
																		);
																		setIsArtifactOpen(
																			true
																		);
																	}}
																>
																	<LayoutGrid className="h-4 w-4" />
																</Button>
															)}
													</Card>
												);
											}
										)
									)}
									<div ref={messagesEndRef}></div>
								</div>
							</div>

							{error && (
								<div className="p-2 bg-red-50 border-t border-red-200 text-red-700 text-sm">
									<p>
										エラーが発生しました:{" "}
										{error?.toString()}
									</p>
								</div>
							)}

							{selectedAgent && (
								<div className="p-4 border-t">
									<div className="flex gap-2 max-w-4xl mx-auto items-end">
										<Textarea
											value={input}
											onChange={handleInputChange}
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
												isLoading || !input.trim()
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

					{isArtifactOpen && artifactContent && artifactType && (
						<>
							<ResizableHandle withHandle />
							<ResizablePanel defaultSize={50} minSize={20}>
								<ArtifactViewer
									artifact={{
										id: "preview",
										type: artifactType,
										title: `${artifactType === "html" ? "HTML" : "Markdown"} プレビュー`,
										content: artifactContent,
										created: new Date(),
									}}
									onClose={() => {
										setIsArtifactOpen(false);
										setArtifactContent(null);
										setArtifactType(null);
									}}
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

			<Toaster />
		</SidebarProvider>
	);
}

function App() {
	return <AppContent />;
}

export default App;
