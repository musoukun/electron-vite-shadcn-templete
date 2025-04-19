import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
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
	}
}

interface ArtifactViewProps {
	content: string | null;
	onClose: () => void;
	isOpen: boolean;
}

export const ArtifactView: React.FC<ArtifactViewProps> = ({
	content,
	onClose,
	isOpen,
}) => {
	if (!isOpen || !content) {
		return null; // 表示されていない、またはコンテンツがない場合は何もレンダリングしない
	}

	console.log("ArtifactView: コンテンツ長さ =", content.length);

	// リンククリックハンドラ - 外部ブラウザで開く
	const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
		const link = event.currentTarget;
		const href = link.getAttribute("href");

		if (
			href &&
			(href.startsWith("http://") || href.startsWith("https://"))
		) {
			event.preventDefault(); // デフォルトの動作をキャンセル
			console.log(`外部ブラウザでリンクを開きます: ${href}`);

			// Electronの機能を使って外部ブラウザで開く
			window.electronShell
				.openExternalLink(href)
				.then((result) => {
					if (!result.success) {
						console.error(
							"外部リンクを開けませんでした:",
							result.error
						);
					}
				})
				.catch((error) => {
					console.error("openExternalLink呼び出しエラー:", error);
				});
		}
	};

	// content が URL か HTML 文字列かを簡易的に判定
	const isUrl = content.trim().startsWith("http");
	const isHtml =
		content.includes("<html") || content.includes("<!DOCTYPE html");
	const isMarkdown =
		!isUrl &&
		!isHtml &&
		(content.includes("# ") ||
			content.includes("## ") ||
			content.split("\n").length > 5);

	return (
		<div className="flex flex-col h-full border-l bg-background">
			{/* ヘッダー */}
			<div className="p-2 border-b flex justify-between items-center shrink-0">
				<span className="text-sm font-semibold">
					{isHtml ? "HTML" : isMarkdown ? "Markdown" : "コンテンツ"}
					プレビュー
				</span>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-6 w-6"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{/* コンテンツ表示エリア */}
			<div className="flex-1 overflow-auto">
				{isUrl ? (
					<div className="flex items-center justify-center h-full flex-col p-6">
						<p className="mb-4 text-center">
							外部URLが検出されました:
						</p>
						<div className="max-w-full overflow-hidden text-ellipsis mb-4">
							<a
								href={content}
								onClick={handleLinkClick}
								className="text-blue-500 hover:underline break-all"
							>
								{content}
							</a>
						</div>
						<Button
							onClick={(e) => {
								e.preventDefault();
								handleLinkClick({
									currentTarget: {
										getAttribute: () => content,
									},
								} as any);
							}}
						>
							外部ブラウザで開く
						</Button>
					</div>
				) : isHtml ? (
					<iframe
						srcDoc={`
							<html>
								<head>
									<style>
										body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; }
										a { color: #3b82f6; }
									</style>
									<script>
										// すべてのリンクをラップして外部ブラウザで開くようにする
										document.addEventListener('DOMContentLoaded', () => {
											const links = document.querySelectorAll('a');
											links.forEach(link => {
												link.addEventListener('click', (e) => {
													e.preventDefault();
													// カスタムイベントを通じて親ウィンドウに通知
													window.parent.postMessage({ 
														type: 'open-external-link', 
														url: link.href 
													}, '*');
												});
											});
										});
									</script>
								</head>
								<body>${content}</body>
							</html>
						`}
						title="HTML Preview"
						className="w-full h-full border-0"
						sandbox="allow-scripts" // スクリプト実行を許可
						onLoad={() => {
							// iframeからのメッセージを受け取る
							window.addEventListener("message", (event) => {
								if (
									event.data &&
									event.data.type === "open-external-link"
								) {
									const url = event.data.url;
									if (
										url &&
										(url.startsWith("http://") ||
											url.startsWith("https://"))
									) {
										console.log(
											`iframe内リンクを外部ブラウザで開きます: ${url}`
										);
										window.electronShell
											.openExternalLink(url)
											.catch((error) =>
												console.error(
													"外部リンクを開けませんでした:",
													error
												)
											);
									}
								}
							});
						}}
					/>
				) : (
					<div className="p-4 prose dark:prose-invert max-w-none">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							components={{
								// リンクの処理をカスタマイズ
								a: ({ node, ...props }) => (
									<a
										{...props}
										onClick={handleLinkClick}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-500 hover:underline"
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
										match && match[1]
											? match[1].toLowerCase()
											: "";

									// 入れ子コードブロック向けの特別処理
									let content = "";
									if (Array.isArray(children)) {
										content = children
											.map((child) => {
												if (typeof child === "string")
													return child;
												return "";
											})
											.join("");
									} else {
										content = String(children);
									}

									if (inline) {
										return (
											<code
												className={className}
												{...props}
											>
												{content}
											</code>
										);
									}

									return (
										<div className="relative my-4">
											{lang && (
												<div className="absolute top-0 right-0 text-xs bg-gray-800 text-white px-2 py-1 rounded-bl">
													{lang}
												</div>
											)}
											<pre
												className={`${className || ""} p-4 overflow-x-auto syntax-highlighted`}
											>
												<code
													{...props}
													className={`language-${lang || "text"}`}
												>
													{content}
												</code>
											</pre>
										</div>
									);
								},
							}}
						>
							{(() => {
								// 入れ子コードブロックがある場合に処理
								// ```markdownで始まり、内部に他のコードブロックがある場合を検出
								let processedContent = content;

								// マークダウンブロックがなければそのまま返す
								if (!content.includes("```markdown")) {
									return processedContent;
								}

								console.log(
									"ArtifactView: ```markdownブロックを検出しました"
								);

								// マークダウンの元のコンテンツから実際の表示用コンテンツを再構築する
								let result = "";

								// 先頭の説明文などをそのまま追加
								const startMarkdownBlock =
									content.indexOf("```markdown");
								if (startMarkdownBlock > 0) {
									result +=
										content
											.substring(0, startMarkdownBlock)
											.trim() + "\n\n";
								}

								// マークダウンブロック内のコンテンツを抽出
								const markdownMatch =
									/```markdown\s*([\s\S]*?)```/.exec(content);
								if (!markdownMatch || !markdownMatch[1]) {
									console.error(
										"マークダウンブロックの内容が抽出できませんでした"
									);
									return content;
								}

								const markdownContent = markdownMatch[1];

								// コードブロックのパターン（```言語名 から始まり ```で終わるブロック）
								const codeBlockRegex = /```(\w+)([^`]*?)```/g;
								let lastIndex = 0;
								let match;

								// マークダウンコンテンツ内の全てのコードブロックを検出して処理
								while (
									(match =
										codeBlockRegex.exec(
											markdownContent
										)) !== null
								) {
									const lang = match[1];
									const code = match[2];
									const matchStart = match.index;
									const matchEnd =
										matchStart + match[0].length;

									console.log(
										`ArtifactView: コードブロック検出: 言語=${lang}`
									);

									// マークダウンブロックの前の部分を追加
									result += markdownContent.substring(
										lastIndex,
										matchStart
									);

									// 言語付きコードブロックを追加（正しい構文で）
									result +=
										"\n```" +
										lang +
										"\n" +
										code.trim() +
										"\n```\n\n";

									lastIndex = matchEnd;
								}

								// 残りのマークダウン内容を追加
								if (lastIndex < markdownContent.length) {
									result +=
										markdownContent.substring(lastIndex);
								}

								// マークダウンブロック後の内容も追加
								const endMarkdownBlock =
									content.indexOf(
										"```",
										markdownMatch.index + 11
									) + 3;
								if (endMarkdownBlock < content.length) {
									result +=
										"\n\n" +
										content
											.substring(endMarkdownBlock)
											.trim();
								}

								return result;
							})()}
						</ReactMarkdown>
					</div>
				)}
			</div>
		</div>
	);
};
