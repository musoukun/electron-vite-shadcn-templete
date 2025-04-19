import React from "react";
import { Artifact } from "@/types/artifact";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// マークダウンパース用
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlight } from "remark-sugar-high";

interface ArtifactViewerProps {
	artifact: Artifact;
	onClose?: () => void;
}

/**
 * アーティファクト表示コンポーネント
 * 様々な種類のアーティファクトを表示する
 */
export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({
	artifact,
	onClose,
}) => {
	// contentから末尾の```だけを削除する関数
	const removeTrailingCodeFence = (content: string) => {
		if (!content) return "";

		// 最後に出現する```の位置を取得
		const lastFenceIndex = content.lastIndexOf("```");

		// ```が見つからない場合はそのまま返す
		if (lastFenceIndex === -1) return content;

		// // 最後の```を削除したコンテンツを返す
		// console.log(
		// 	content.substring(0, lastFenceIndex) +
		// 		content.substring(lastFenceIndex + 3)
		// );
		return (
			content.substring(0, lastFenceIndex) +
			content.substring(lastFenceIndex + 3)
		);
	};

	// 先頭の ```markdown を削除する関数
	const removeLeadingMarkdownFence = (content: string) => {
		if (!content) return "";

		// 先頭に出現する```markdownの位置を取得
		const firstFenceIndex = content.indexOf("```markdown");

		if (firstFenceIndex === -1) return content; // ```markdownが見つからない場合

		// ```markdownの長さを計算（改行まで含める）
		const fenceEnd = content.indexOf("\n", firstFenceIndex);
		const fenceLength = fenceEnd - firstFenceIndex + 1; // 改行文字も含める

		// console.log(
		// 	"先頭削除: ",
		// 	content.substring(0, firstFenceIndex) +
		// 		content.substring(firstFenceIndex + fenceLength)
		// );

		// 先頭のフェンスを削除
		return (
			content.substring(0, firstFenceIndex) +
			content.substring(firstFenceIndex + fenceLength)
		);
	};

	// アーティファクトの種類に応じたコンテンツをレンダリングする関数
	const renderContent = () => {
		console.log("ArtifactViewer: artifact type =", artifact.type);
		let contentToRender = artifact.content || ""; // 全コンテンツを使用

		contentToRender = removeLeadingMarkdownFence(contentToRender);
		contentToRender = removeTrailingCodeFence(contentToRender);
		console.log("末尾の```を削除しました", contentToRender);

		switch (artifact.type) {
			case "code":
				// codeタイプの場合は、指定された言語のコードブロックとして表示
				console.log(
					"コード表示: コンテンツ長さ =",
					contentToRender.length
				);
				return (
					<ScrollArea className="h-full w-full p-4">
						<div className="max-w-none">
							{" "}
							{/* proseクラスを削除 */}
							<ReactMarkdown
								remarkPlugins={[remarkGfm, highlight]} // GFMとハイライトプラグインを適用
								components={{
									// codeコンポーネントのカスタマイズ (ハイライトのためクラス付与)
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
										// classNameから言語を抽出、なければartifact.language、それもなければ'text'
										const lang =
											match?.[1]?.toLowerCase() ??
											artifact.language ??
											"text";

										let textContent = "";
										if (Array.isArray(children)) {
											textContent = children
												.map((child: any) =>
													typeof child === "string"
														? child
														: ""
												)
												.join("");
										} else {
											textContent = String(
												children
											).replace(/\n$/, "");
										}

										if (inline) {
											// インラインコードのスタイル
											return (
												<code
													className={`${className || ""} bg-muted/80 text-muted-foreground px-1 rounded-sm text-sm`}
													{...props}
												>
													{textContent}
												</code>
											);
										}

										// コードブロック表示 (suger-high対応)
										return (
											<div className="relative code-block-wrapper w-full my-4 not-prose">
												{" "}
												{/* not-proseを追加 */}
												{lang !== "text" && ( // 言語表示
													<div className="absolute top-2 right-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded z-10">
														{lang}
													</div>
												)}
												{/* preタグ: スタイルを適用 */}
												<pre
													className={`rounded-md p-4 overflow-x-auto w-full whitespace-pre-wrap break-words bg-muted/50 border border-border`}
												>
													{/* codeタグ: language-xxxクラスを付与 */}
													<code
														{...props}
														className={`language-${lang}`}
													>
														{textContent}
													</code>
												</pre>
											</div>
										);
									},
								}}
							>
								{/* artifact.content を指定言語のコードブロックとしてラップ */}
								{`\`\`\`${artifact.language || ""}\n${contentToRender}\n\`\`\``}
							</ReactMarkdown>
						</div>
					</ScrollArea>
				);

			case "markdown":
				// markdownタイプの場合、全コンテンツをReactMarkdownで表示
				console.log(
					"マークダウン表示: コンテンツ長さ =",
					contentToRender.length
				);
				return (
					<ScrollArea className="h-full w-full p-4">
						{/* proseクラスで基本的なマークダウンスタイルを適用 */}
						<div className="prose dark:prose-invert max-w-none">
							<ReactMarkdown
								remarkPlugins={[remarkGfm, highlight]} // GFMとハイライトプラグインを適用
							>
								{/* 全コンテンツを渡す */}
								{contentToRender}
							</ReactMarkdown>
						</div>
					</ScrollArea>
				);

			// html, svg, mermaid, react, default は変更なし
			case "html":
				return (
					<div className="w-full h-full">
						<iframe
							srcDoc={artifact.content}
							title={artifact.title}
							className="w-full h-full border-0"
							sandbox="allow-scripts"
						/>
					</div>
				);
			case "svg":
				return (
					<div className="flex items-center justify-center w-full h-full p-4 bg-white">
						<div
							dangerouslySetInnerHTML={{
								__html: artifact.content,
							}}
						/>
					</div>
				);
			case "mermaid":
				return (
					<div className="w-full h-full p-4 flex items-center justify-center">
						<p>
							Mermaidダイアグラムのプレビューはまだ実装されていません
						</p>
					</div>
				);
			case "react":
				return (
					<div className="w-full h-full p-4 flex items-center justify-center">
						<p>
							Reactコンポーネントのプレビューはまだ実装されていません
						</p>
					</div>
				);
			default:
				// 不明なタイプはプレーンテキストとして表示
				return (
					<div className="w-full h-full p-4">
						<pre className="whitespace-pre-wrap">
							{artifact.content || ""}
						</pre>
					</div>
				);
		}
	};

	return (
		<Card className="flex flex-col h-full overflow-hidden">
			<CardHeader className="p-2 border-b flex-shrink-0 flex justify-between items-center">
				<CardTitle className="text-sm font-medium">
					{artifact.title}
				</CardTitle>
				{onClose && (
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-6 w-6"
					>
						<X className="h-4 w-4" />
					</Button>
				)}
			</CardHeader>
			<CardContent className="p-0 flex-1 overflow-hidden">
				{renderContent()}
			</CardContent>
		</Card>
	);
};
