import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// エージェントの型定義
interface Agent {
	id: string;
	name: string;
	description?: string;
}

// ダイアログのプロパティ
interface AgentSelectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onModelSelect: (agentId: string) => void; // App.tsxとの互換性のためにonModelSelectという名前を維持
}

export function ModelSelectDialog({
	open,
	onOpenChange,
	onModelSelect, // 名前はModelSelectのままですが、Agentの選択に使用します
}: AgentSelectDialogProps) {
	const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
	const [selectedAgentId, setSelectedAgentId] = useState<string>("");
	const [currentAgentId, setCurrentAgentId] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);

	// 利用可能なエージェント一覧を取得
	useEffect(() => {
		if (open) {
			const fetchAgents = async () => {
				setIsLoading(true);
				try {
					// エージェント一覧を取得
					const agents = await window.electronAPI?.getAgents();
					if (agents && Array.isArray(agents)) {
						setAvailableAgents(agents);

						// 現在選択されているモデル(エージェント)のIDを取得
						const currentModelId =
							await window.electronAPI?.getSelectedModel();
						if (currentModelId) {
							setCurrentAgentId(currentModelId);
							setSelectedAgentId(currentModelId);
						} else if (agents.length > 0) {
							// 現在選択されているエージェントがない場合は最初のものを選択
							setSelectedAgentId(agents[0].id);
						}
					}
				} catch (error) {
					console.error("エージェント取得エラー:", error);
				} finally {
					setIsLoading(false);
				}
			};

			fetchAgents();
		}
	}, [open]);

	// 選択を確定して親コンポーネントに通知
	const handleSubmit = () => {
		if (selectedAgentId) {
			onModelSelect(selectedAgentId); // エージェントIDを親コンポーネントに通知
			onOpenChange(false);
		}
	};

	// ラジオボタンの代わりにdivをクリックして選択する実装
	const handleAgentClick = (agentId: string) => {
		setSelectedAgentId(agentId);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>エージェントを選択</DialogTitle>
					<DialogDescription>
						使用するAIエージェントを選択してください。
					</DialogDescription>
				</DialogHeader>

				<div className="py-4 space-y-3">
					{availableAgents.map((agent) => (
						<div
							key={agent.id}
							className={`flex items-start space-x-3 space-y-0 border p-3 rounded-md cursor-pointer ${
								selectedAgentId === agent.id
									? "border-primary bg-primary/5"
									: ""
							}`}
							onClick={() => handleAgentClick(agent.id)}
						>
							<div className="w-4 h-4 mt-1 rounded-full border flex items-center justify-center">
								{selectedAgentId === agent.id && (
									<div className="w-2 h-2 rounded-full bg-primary"></div>
								)}
							</div>
							<div className="space-y-1">
								<div className="font-medium cursor-pointer">
									{agent.name}
									{currentAgentId === agent.id &&
										" (現在選択中)"}
								</div>
								{agent.description && (
									<p className="text-sm text-muted-foreground">
										{agent.description}
									</p>
								)}
							</div>
						</div>
					))}
				</div>

				<DialogFooter>
					<Button
						type="submit"
						onClick={handleSubmit}
						disabled={!selectedAgentId || isLoading}
					>
						{isLoading ? "読込中..." : "選択"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
