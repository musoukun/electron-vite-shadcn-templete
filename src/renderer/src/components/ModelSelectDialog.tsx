import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface Model {
	id: string;
	name: string;
}

interface ModelSelectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onModelSelect: (modelId: string) => void;
}

export function ModelSelectDialog({
	open,
	onOpenChange,
	onModelSelect,
}: ModelSelectDialogProps) {
	const [availableModels, setAvailableModels] = useState<Model[]>([]);
	const [selectedModelId, setSelectedModelId] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [currentModelId, setCurrentModelId] = useState<string>("");

	// 利用可能なモデルを取得
	useEffect(() => {
		const fetchModels = async () => {
			try {
				if (window.electronAPI?.getAvailableModels) {
					const models = await window.electronAPI.getAvailableModels();
					setAvailableModels(models);
					
					// 現在選択されているモデルを取得
					if (window.electronAPI?.getSelectedModel) {
						const currentModel = await window.electronAPI.getSelectedModel();
						setCurrentModelId(currentModel);
						
						// 初回表示時、現在のモデルを選択状態にする
						if (!selectedModelId) {
							setSelectedModelId(currentModel);
						}
					}
				}
			} catch (error) {
				console.error("モデル一覧の取得に失敗しました:", error);
			}
		};
		
		if (open) {
			fetchModels();
		}
	}, [open, selectedModelId]);

	const handleSubmit = async () => {
		if (!selectedModelId) return;

		setIsSubmitting(true);
		try {
			// 選択されたモデルを親コンポーネントに通知
			onModelSelect(selectedModelId);
			onOpenChange(false);
		} catch (error) {
			console.error("モデル選択中にエラーが発生しました:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>AIモデルの選択</DialogTitle>
					<DialogDescription>
						使用するAIモデルを選択してください。
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					{currentModelId && (
						<div className="text-sm text-muted-foreground">
							現在のモデル: <span className="font-medium">{
								availableModels.find(model => model.id === currentModelId)?.name || currentModelId
							}</span>
						</div>
					)}
					<Select
						value={selectedModelId}
						onValueChange={setSelectedModelId}
					>
						<SelectTrigger>
							<SelectValue placeholder="モデルを選択" />
						</SelectTrigger>
						<SelectContent>
							{availableModels.map((model) => (
								<SelectItem key={model.id} value={model.id}>
									{model.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						variant="outline"
					>
						キャンセル
					</Button>
					<Button onClick={handleSubmit} disabled={isSubmitting || !selectedModelId}>
						{isSubmitting ? "選択中..." : "選択"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
