// This file should be removedimport React from "react";
import { Artifact } from "@/types/artifact";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// シンタックスハイライト用
import SyntaxHighlighter from "react-syntax-highlighter";
import { vs2015 } from "react-syntax-highlighter/dist/esm/styles/hljs";

// マークダウンパース用
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
	// アーティファクトの種類に応じたコンテンツをレンダリング
	const renderContent = () => {
		switch (artifact.type) {
			case "code":
				return (
					<ScrollArea className="h-full w-full">
						<SyntaxHighlighter
							language={artifact.language || "text"}
							style={vs2015}
							customStyle={{ background: "transparent" }}
							className="w-full h-full"
						>
							{artifact.content}
						</SyntaxHighlighter>
					</ScrollArea>
				);

			case "markdown":
				return (
					<ScrollArea className="h-full w-full p-4">
						<div className="prose dark:prose-invert max-w-none">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{artifact.content}
							</ReactMarkdown>
						</div>
					</ScrollArea>
				);

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
				// Mermaidは事前にクライアントサイドでレンダリングする必要あり
				// 実装は別途必要
				return (
					<div className="w-full h-full p-4 flex items-center justify-center">
						<p>
							Mermaidダイアグラムのプレビューはまだ実装されていません
						</p>
					</div>
				);

			case "react":
				// Reactコンポーネントの動的レンダリングは複雑なため、
				// 実際の実装では別途対応が必要
				return (
					<div className="w-full h-full p-4 flex items-center justify-center">
						<p>
							Reactコンポーネントのプレビューはまだ実装されていません
						</p>
					</div>
				);

			default:
				return (
					<div className="w-full h-full p-4">
						<pre className="whitespace-pre-wrap">
							{artifact.content}
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
