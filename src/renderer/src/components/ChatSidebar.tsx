import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "./ui/sheet";
import { Agent, Thread } from "@/types";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface ChatSidebarProps {
	threads: Thread[];
	selectedThread: Thread | null;
	selectedAgent: Agent | null;
	onThreadSelect: (thread: Thread) => void;
	onNewChat: () => void;
	isMobile: boolean;
}

export function ChatSidebar({
	threads,
	selectedThread,
	selectedAgent,
	onThreadSelect,
	onNewChat,
	isMobile,
}: ChatSidebarProps) {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!isMobile) {
			setOpen(true);
		}
	}, [isMobile]);

	const sidebarContent = (
		<>
			<SheetHeader className="px-4">
				<SheetTitle>会話履歴</SheetTitle>
			</SheetHeader>
			<div className="flex flex-col p-4">
				<Button onClick={onNewChat} className="mb-4">
					<PlusIcon className="mr-2 h-4 w-4" />
					新しい会話
				</Button>
				<ScrollArea className="h-[calc(100vh-8rem)]">
					<div className="flex flex-col gap-2">
						{threads.map((thread) => (
							<div
								key={thread.id}
								className={`cursor-pointer rounded-lg p-3 hover:bg-accent ${
									selectedThread?.id === thread.id
										? "bg-accent font-medium"
										: ""
								}`}
								onClick={() => {
									onThreadSelect(thread);
									if (isMobile) {
										setOpen(false);
									}
								}}
							>
								<div className="line-clamp-1 text-sm font-medium">
									{thread.title}
								</div>
								<div className="line-clamp-1 text-xs text-muted-foreground">
									{selectedAgent?.name ||
										"エージェント未選択"}
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			</div>
		</>
	);

	if (isMobile) {
		return (
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						className="absolute left-4 top-4 z-40 md:hidden"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="h-4 w-4"
						>
							<rect
								width="18"
								height="18"
								x="3"
								y="3"
								rx="2"
								ry="2"
							/>
							<line x1="9" x2="15" y1="3" y2="3" />
							<line x1="3" x2="3" y1="9" y2="15" />
							<line x1="21" x2="21" y1="9" y2="15" />
							<line x1="9" x2="15" y1="21" y2="21" />
						</svg>
					</Button>
				</SheetTrigger>
				<SheetContent
					side="left"
					className="w-full max-w-xs sm:max-w-sm"
				>
					{sidebarContent}
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<div className="hidden border-r bg-background md:block md:w-80 lg:w-96">
			{sidebarContent}
		</div>
	);
}
