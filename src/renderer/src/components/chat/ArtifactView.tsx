import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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

	// content が URL か HTML 文字列かを簡易的に判定
	const isUrl = content.trim().startsWith("http");

	return (
		<div className="flex flex-col h-full border-l bg-background">
			{/* ヘッダー */}
			<div className="p-2 border-b flex justify-between items-center shrink-0">
				<span className="text-sm font-semibold">プレビュー</span>
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
					<iframe
						src={content}
						title="Artifact Preview"
						className="w-full h-full border-0"
						sandbox="allow-scripts allow-same-origin" // セキュリティのためのサンドボックス設定
					/>
				) : (
					<iframe
						srcDoc={content} // HTML文字列を直接埋め込む
						title="Artifact Preview"
						className="w-full h-full border-0"
						sandbox="allow-scripts" // スクリプト実行を許可（必要に応じて）
					/>
				)}
			</div>
		</div>
	);
};
