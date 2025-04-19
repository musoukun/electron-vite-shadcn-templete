import React from "react";
import { ChatMessage } from "@/types/chat";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { highlight } from "remark-sugar-high";

interface MessageContentProps {
	message: ChatMessage;
	handleLinkClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * チャットメッセージの内容を表示するコンポーネント
 * Artifactと同じデザインでマークダウンを表示します
 */
export const MessageContent: React.FC<MessageContentProps> = ({
	message,
	handleLinkClick,
}) => {
	// contentから先頭の ```markdown を削除する関数
	const removeLeadingMarkdownFence = (content: string) => {
		if (!content) return "";

		// 先頭に出現する```markdownの位置を取得
		const firstFenceIndex = content.indexOf("```markdown");

		if (firstFenceIndex === -1) return content; // ```markdownが見つからない場合

		// ```markdownの長さを計算（改行まで含める）
		const fenceEnd = content.indexOf("\n", firstFenceIndex);
		const fenceLength = fenceEnd - firstFenceIndex + 1; // 改行文字も含める

		// 先頭のフェンスを削除
		return (
			content.substring(0, firstFenceIndex) +
			content.substring(firstFenceIndex + fenceLength)
		);
	};

	// contentから末尾の```だけを削除する関数
	const removeTrailingCodeFence = (content: string) => {
		if (!content) return "";

		// 最後に出現する```の位置を取得
		const lastFenceIndex = content.lastIndexOf("```");

		// ```が見つからない場合はそのまま返す
		if (lastFenceIndex === -1) return content;

		// 最後の```を削除したコンテンツを返す
		return (
			content.substring(0, lastFenceIndex) +
			content.substring(lastFenceIndex + 3)
		);
	};

	// コードブロックを検出して直接処理する
	const processCodeBlocks = (content: string) => {
		// コードブロックのパターン: ```language\ncode```
		const regex = /```([a-zA-Z0-9]+)?\n([\s\S]*?)```/g;
		let match;
		let result = content;
		const blocks = [];

		// すべてのコードブロックを見つける
		while ((match = regex.exec(content)) !== null) {
			const language = match[1] || "";
			const code = match[2];
			const fullMatch = match[0];
			const startIndex = match.index;
			const endIndex = startIndex + fullMatch.length;

			blocks.push({
				language,
				code,
				startIndex,
				endIndex,
				fullMatch,
			});
		}

		return blocks;
	};

	console.log(
		"Rendering Markdown for message:",
		message.id,
		"\nContent:\n",
		message.content
	);

	// マークダウンフェンスの除去処理を適用
	let processedContent = message.content || "";
	processedContent = removeLeadingMarkdownFence(processedContent);
	processedContent = removeTrailingCodeFence(processedContent);

	// コードブロックの抽出
	const codeBlocks = processCodeBlocks(processedContent);
	console.log("検出されたコードブロック:", codeBlocks.length);

	return (
		<ScrollArea className="w-full h-full">
			<div className="prose dark:prose-invert max-w-none prose-notion p-4">
				<ReactMarkdown
					remarkPlugins={[remarkGfm, remarkMath, highlight]}
					rehypePlugins={[rehypeKatex]}
					components={{
						a: (props: any) => (
							<a
								{...props}
								onClick={handleLinkClick}
								target="_blank"
								rel="noopener noreferrer"
							/>
						),
						code: ({
							node,
							inline,
							className,
							children,
							...props
						}: any) => {
							const match = /language-(\w+)/.exec(
								className || ""
							);
							const lang =
								match && match[1] ? match[1].toLowerCase() : "";

							if (inline) {
								return (
									<code
										className="bg-muted px-1 rounded text-sm"
										{...props}
									>
										{children}
									</code>
								);
							}

							// コードブロック表示用の特別な処理
							return (
								<div className="relative my-4 w-full">
									{lang && (
										<div className="absolute top-2 right-2 text-xs bg-muted px-2 py-1 rounded z-10">
											{lang}
										</div>
									)}
									<pre className="rounded-md p-4 overflow-x-auto w-full bg-muted/50 border-border border">
										<code
											className={
												lang ? `language-${lang}` : ""
											}
											{...props}
										>
											{children}
										</code>
									</pre>
								</div>
							);
						},
						pre: ({ children, ...props }: any) => {
							return (
								<div className="w-full overflow-auto">
									<pre {...props}>{children}</pre>
								</div>
							);
						},
					}}
				>
					{processedContent}
				</ReactMarkdown>

				{/* ローディングインジケーター用のプレースホルダー */}
				{message.role === "assistant" && message.content === "" && (
					<span className="animate-pulse">▌</span>
				)}

				{/* 検出したコードブロックを表示（デバッグ用） */}
				{false && codeBlocks.length > 0 && (
					<div className="mt-4 border-t pt-4">
						<h4>
							デバッグ情報: 検出されたコードブロック (
							{codeBlocks.length})
						</h4>
						{codeBlocks.map((block, i) => (
							<div key={i} className="mt-2 p-2 border rounded">
								<div>言語: {block.language || "なし"}</div>
								<pre className="text-xs mt-1 p-2 bg-muted">
									{block.code}
								</pre>
							</div>
						))}
					</div>
				)}
			</div>
		</ScrollArea>
	);
};

export default MessageContent;
