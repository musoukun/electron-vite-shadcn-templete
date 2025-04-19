import React from "react";
import { ChatMessage } from "@/types/chat";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { highlight } from "sugar-high";

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
	// コンテンツの前処理（コードブロック認識を改善）
	const processContent = (content: string): string => {
		if (!content) return "";

		// ArtifactViewerと同様の処理を実装
		let processed = content;

		// 先頭の```markdownを削除
		const firstFenceIndex = processed.indexOf("```markdown");
		if (firstFenceIndex !== -1) {
			const fenceEnd = processed.indexOf("\n", firstFenceIndex);
			if (fenceEnd !== -1) {
				processed =
					processed.substring(0, firstFenceIndex) +
					processed.substring(fenceEnd + 1);
			}
		}

		// コードブロックの修正
		processed = processed.replace(/```(\w+)(?!\n)/g, "```$1\n");

		// 残っているコードブロックが閉じられているか確認
		const fenceMatches = processed.match(/```/g) || [];
		if (fenceMatches.length % 2 !== 0) {
			processed += "\n```";
		}

		return processed;
	};

	// コードブロック用のコンポーネント
	const MarkdownComponents = {
		// リンクの処理
		a: ({ node, ...props }: any) => (
			<a
				{...props}
				onClick={handleLinkClick}
				target="_blank"
				rel="noopener noreferrer"
			/>
		),
		// 画像の処理
		img: ({ node, ...props }: any) => (
			<img
				{...props}
				className="max-w-full rounded-md my-2"
				alt={props.alt || "画像"}
			/>
		),
		// コードブロックの処理をカスタマイズ
		code: ({ node, inline, className, children, ...props }: any) => {
			const match = /language-(\w+)/.exec(className || "");
			const lang = match && match[1] ? match[1].toLowerCase() : "";

			// 文字列処理
			let content = "";
			if (Array.isArray(children)) {
				content = children
					.map((child) => (typeof child === "string" ? child : ""))
					.join("");
			} else {
				content = String(children).replace(/\n$/, "");
			}

			// インラインコードの場合
			if (inline) {
				return (
					<code
						className={`${className || ""} bg-muted/80 text-muted-foreground px-1 rounded-sm text-sm`}
						{...props}
					>
						{content}
					</code>
				);
			}

			// コードブロックの言語が空の場合、内容から推測
			if (!lang) {
				if (
					content.includes("function") ||
					content.includes("var ") ||
					content.includes("const ")
				) {
					// JavaScriptっぽい
					const langToUse = "js";
					try {
						return createCodeBlock(content, langToUse);
					} catch (error) {
						// 失敗したら通常のコードブロックで表示
						return createCodeBlock(content);
					}
				}
			}

			// 言語が指定されたコードブロックの場合
			try {
				return createCodeBlock(content, lang);
			} catch (error) {
				// ハイライトに失敗した場合は通常のコードブロックとして表示
				return createCodeBlock(content);
			}
		},
	};

	// コードブロック生成のヘルパー関数
	const createCodeBlock = (content: string, lang?: string) => {
		// コンテンツが空の場合の対応
		if (!content.trim()) {
			return (
				<pre className="rounded-md p-4 overflow-x-auto w-full whitespace-pre-wrap break-words bg-muted/50 border border-border">
					<code className="text-muted-foreground">
						(空のコードブロック)
					</code>
				</pre>
			);
		}

		let highlighted = content;
		try {
			if (lang) {
				highlighted = highlight(content);
			}
		} catch (e) {
			console.error("ハイライト処理に失敗:", e);
			// エラー時は元のコンテンツを使用
		}

		return (
			<div className="relative code-block-wrapper w-full my-4 not-prose">
				{lang && (
					<div className="absolute top-2 right-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded z-10">
						{lang}
					</div>
				)}
				<pre className="rounded-md p-4 overflow-x-auto w-full whitespace-pre-wrap break-words bg-muted/50 border border-border">
					<code
						className={`language-${lang || "text"}`}
						dangerouslySetInnerHTML={{
							__html: highlighted,
						}}
					/>
				</pre>
			</div>
		);
	};

	const processedContent = processContent(message.content);

	console.log("Processed Content:", processedContent);
	return (
		<ScrollArea className="w-full h-full">
			<div className="prose dark:prose-invert max-w-none prose-notion p-4">
				<ReactMarkdown
					remarkPlugins={[remarkGfm, remarkMath]}
					rehypePlugins={[rehypeKatex]}
					components={MarkdownComponents}
				>
					{processedContent || ""}
				</ReactMarkdown>

				{/* ローディングインジケーター用のプレースホルダー */}
				{message.role === "assistant" && message.content === "" && (
					<span className="animate-pulse">▌</span>
				)}
			</div>
		</ScrollArea>
	);
};

export default MessageContent;
