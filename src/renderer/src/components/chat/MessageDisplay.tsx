import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as sugarHigh from "sugar-high";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChatMessage as Message } from "@/types/chat";
import { shell } from "electron";

// リンクをデフォルトブラウザで開くためのハンドラー
const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
	event.preventDefault();
	const href = event.currentTarget.href;
	if (href) {
		shell.openExternal(href);
	}
};

interface MessageDisplayProps {
	message: Message;
	isLoading?: boolean;
	agentName?: string;
}

// コードブロックをハイライトする関数
const highlightCode = (code: string, language?: string) => {
	try {
		return sugarHigh.highlight(code);
	} catch (error) {
		console.error("Failed to highlight code:", error);
		return code;
	}
};

export const MessageDisplay: React.FC<MessageDisplayProps> = ({
	message,
	isLoading = false,
	agentName,
}) => {
	const isUser = message.role === "user";
	const isAssistant = message.role === "assistant";
	const displayName = isAssistant ? agentName || "AI" : "あなた";

	return (
		<div
			className={cn(
				"flex w-full",
				isUser ? "justify-end" : "justify-start"
			)}
		>
			<div
				className={cn(
					"flex flex-col max-w-[80%]",
					isUser ? "items-end" : "items-start"
				)}
			>
				<div className="text-sm text-muted-foreground mb-1">
					{displayName}
				</div>
				<Card
					className={cn(
						"mb-4",
						isUser
							? "bg-primary text-primary-foreground"
							: "bg-card"
					)}
				>
					<CardContent className="py-2 max-w-none break-words">
						{isAssistant && isLoading ? (
							<div className="flex items-center">
								<div className="animate-spin h-4 w-4 mr-2 border-2 border-primary rounded-full border-t-transparent"></div>
								<span>思考中...</span>
							</div>
						) : (
							<ReactMarkdown
								remarkPlugins={[remarkGfm]}
								components={{
									// リンクをデフォルトブラウザで開く
									a: (props) => (
										<a
											{...props}
											onClick={handleLinkClick}
											className="text-blue-500 hover:underline"
											target="_blank"
										/>
									),

									// コードブロックのスタイルとハイライト
									pre: ({ node, ...props }) => (
										<pre
											className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 mt-4 max-w-full"
											{...props}
										/>
									),

									// インラインコードと、コードブロック内のコード
									code: ({
										className,
										children,
										...props
									}: any) => {
										const match = /language-(\w+)/.exec(
											className || ""
										);
										const code = String(children).replace(
											/\n$/,
											""
										);

										if (props.inline) {
											return (
												<code
													className="bg-muted px-1.5 py-0.5 rounded text-sm"
													{...props}
												>
													{children}
												</code>
											);
										}

										return (
											<code
												className="block text-sm font-mono"
												{...props}
												dangerouslySetInnerHTML={{
													__html: highlightCode(
														code,
														match?.[1]
													),
												}}
											/>
										);
									},

									// リストのスタイル
									ul: ({ node, ...props }) => (
										<ul
											className="list-disc pl-6 mb-4 w-full"
											{...props}
										/>
									),
									ol: ({ node, ...props }) => (
										<ol
											className="list-decimal pl-6 mb-4 w-full"
											{...props}
										/>
									),
									li: ({ node, ...props }) => (
										<li
											className="mb-1 w-full"
											{...props}
										/>
									),

									// 見出しのスタイル
									h1: ({ node, ...props }) => (
										<h1
											className="text-2xl font-bold mb-4 mt-6"
											{...props}
										/>
									),
									h2: ({ node, ...props }) => (
										<h2
											className="text-xl font-bold mb-3 mt-5"
											{...props}
										/>
									),
									h3: ({ node, ...props }) => (
										<h3
											className="text-lg font-bold mb-3 mt-4"
											{...props}
										/>
									),
									h4: ({ node, ...props }) => (
										<h4
											className="text-base font-bold mb-2 mt-4"
											{...props}
										/>
									),

									// 水平線のスタイル
									hr: ({ node, ...props }) => (
										<hr
											className="my-4 border-t-2 border-muted"
											{...props}
										/>
									),

									// 引用のスタイル
									blockquote: ({ node, ...props }) => (
										<blockquote
											className="border-l-4 border-muted pl-4 py-1 my-4 italic"
											{...props}
										/>
									),

									// 段落のスタイル
									p: ({ node, ...props }) => (
										<p
											className="mb-4 last:mb-0"
											{...props}
										/>
									),
								}}
							>
								{message.content}
							</ReactMarkdown>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default MessageDisplay;
