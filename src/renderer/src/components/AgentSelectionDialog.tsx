import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Agent } from "@/types";
import { useEffect, useState } from "react";

interface AgentSelectionDialogProps {
	agents: Agent[];
	isOpen: boolean;
	onAgentSelect: (agent: Agent) => void;
	onClose: () => void;
}

export function AgentSelectionDialog({
	agents,
	isOpen,
	onAgentSelect,
	onClose,
}: AgentSelectionDialogProps) {
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen && agents.length > 0) {
			setSelectedAgentId(agents[0].id);
		}
	}, [isOpen, agents]);

	const handleAgentSelect = () => {
		const agent = agents.find((a) => a.id === selectedAgentId);
		if (agent) {
			onAgentSelect(agent);
			onClose();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>エージェントを選択</DialogTitle>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid grid-cols-1 gap-2">
						{agents.map((agent) => (
							<div
								key={agent.id}
								className={`cursor-pointer rounded-lg border p-4 hover:bg-accent ${
									agent.id === selectedAgentId
										? "border-primary bg-accent"
										: ""
								}`}
								onClick={() => setSelectedAgentId(agent.id)}
							>
								<div className="font-medium">{agent.name}</div>
								<div className="text-sm text-muted-foreground">
									{agent.description}
								</div>
							</div>
						))}
					</div>
				</div>
				<div className="flex justify-end">
					<Button
						onClick={handleAgentSelect}
						disabled={!selectedAgentId}
					>
						選択
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
