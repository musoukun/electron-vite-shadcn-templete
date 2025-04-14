import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface ApiKeyDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ApiKeyDialog({ open, onOpenChange }: ApiKeyDialogProps) {
	const [apiKey, setApiKey] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async () => {
		if (!apiKey.trim()) return;

		setIsSubmitting(true);
		try {
			const result = await window.electronAPI.setApiKey(apiKey);
			if (result.success) {
				onOpenChange(false);
			} else {
				// エラー処理
				console.error("APIキーの設定に失敗しました:", result.message);
			}
		} catch (error) {
			console.error("APIキーの設定中にエラーが発生しました:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Google API キーの設定</DialogTitle>
					<DialogDescription>
						Gemini APIを使用するためのAPIキーを入力してください。
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<Input
						id="apiKey"
						placeholder="Google API キー"
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						type="password"
					/>
				</div>
				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						variant="outline"
					>
						キャンセル
					</Button>
					<Button onClick={handleSubmit} disabled={isSubmitting}>
						{isSubmitting ? "設定中..." : "設定"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
