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

interface Agent {
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
	const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
	const [selectedAgentId, setSelectedAgentId] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [currentAgentId, setCurrentAgentId] = useState<string>("");

	// 利用可能なエージェントを取得
	useEffect(() => {
		const fetchAgents = async () => {
			try {
				if (window.electronAPI?.getAgents) {
					const agents = await window.electronAPI.getAgents();
					setAvailableAgents(agents);

					// 現在選択されているエージェントを取得
					if (window.electronAPI?.getSelectedModel) {
						const currentModel =
							await window.electronAPI.getSelectedModel();
						setCurrentAgentId(currentModel);
						setSelectedAgentId(
							currentModel ||
								(agents.length > 0 ? agents[0].id : "")
						);
					}
				}
			} catch (error) {
				console.error("エージェント一覧の取得に失敗", error);
			}
		};

		if (open) {
			fetchAgents();
		}
	}, [open]);

	const handleSubmit = async () => {
		if (!selectedAgentId) return;

		setIsSubmitting(true);
		try {
			onModelSelect(selectedAgentId);
			onOpenChange(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>AIエージェントの選択</DialogTitle>
					<DialogDescription>
						使用するAIエージェントを選択してください。
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					{currentAgentId && (
						<div className="text-sm text-muted-foreground">
							現在のエージェント:{" "}
							<span className="font-medium">
								{availableAgents.find(
									(agent) => agent.id === currentAgentId
								)?.name || currentAgentId}
							</span>
						</div>
					)}
					<Select
						value={selectedAgentId}
						onValueChange={setSelectedAgentId}
					>
						<SelectTrigger>
							<SelectValue placeholder="エージェントを選択" />
						</SelectTrigger>
						<SelectContent>
							{availableAgents.map((agent) => (
								<SelectItem key={agent.id} value={agent.id}>
									{agent.name}
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
					<Button
						onClick={handleSubmit}
						disabled={isSubmitting || !selectedAgentId}
					>
						選択
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
