import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, User } from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarFooter,
} from "@/components/ui/sidebar";
import { Thread, Agent } from "@/types/chat";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatSidebarProps {
	threads: Thread[];
	selectedThreadId: string | null;
	selectedAgent: Agent | null;
	isThreadsLoading: boolean;
	onThreadSelect: (threadId: string) => void;
	onNewChat: () => void;
}

export function ChatSidebar({
	threads,
	selectedThreadId,
	selectedAgent,
	isThreadsLoading,
	onThreadSelect,
	onNewChat,
}: ChatSidebarProps) {
	return (
		<Sidebar className="w-64 border-r shrink-0">
			{/* サイドバーのコンテンツ */}
			<SidebarHeader className="p-4 border-b">
				<h2 className="text-lg font-semibold">会話履歴</h2>
			</SidebarHeader>

			<SidebarContent className="flex-1 overflow-auto p-2">
				{/* 新規チャットボタン */}
				<Button
					variant="default"
					className="w-full justify-start mb-2"
					onClick={onNewChat}
				>
					<Plus className="mr-2 h-4 w-4" />
					<span>新しい会話</span>
				</Button>

				{/* スレッド一覧 */}
				{isThreadsLoading ? (
					<div className="text-center p-4 text-sm text-muted-foreground">
						読み込み中...
					</div>
				) : threads.length > 0 ? (
					<div className="space-y-1">
						{threads.map((thread) => (
							<Button
								key={thread.id}
								variant={
									selectedThreadId === thread.id
										? "secondary"
										: "ghost"
								}
								className="w-full justify-start text-sm"
								onClick={() => onThreadSelect(thread.id)}
							>
								<MessageSquare className="mr-2 h-4 w-4" />
								<div className="flex flex-col items-start overflow-hidden w-full">
									<span className="truncate w-full">
										{thread.title || "無題の会話"}
									</span>
									{thread.agentName && (
										<span className="text-xs text-muted-foreground truncate w-full">
											{thread.agentName}
										</span>
									)}
								</div>
							</Button>
						))}
					</div>
				) : selectedAgent ? (
					<div className="text-center p-4 text-sm text-muted-foreground">
						会話履歴がありません
					</div>
				) : (
					<div className="text-center p-4 text-sm text-muted-foreground">
						メッセージを送信して会話を開始してください
					</div>
				)}
			</SidebarContent>

			{/* アカウント情報 */}
			<SidebarFooter className="p-4 border-t mt-auto">
				<div className="flex items-center gap-2">
					<div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
						<User size={16} />
					</div>
					<div>
						<p className="text-sm font-medium">
							{selectedAgent ? selectedAgent.name : "Agent未選択"}
						</p>
						<p className="text-xs text-muted-foreground">
							{selectedAgent?.description
								? selectedAgent.description.substring(0, 30) +
									"..."
								: "Mastra API"}
						</p>
					</div>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
