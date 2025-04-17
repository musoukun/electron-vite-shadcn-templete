import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatMessage as ChatMessageType, Agent } from "@/types/chat";

interface ChatAreaProps {
	messages: ChatMessageType[];
	currentMessage: string;
	isLoading: boolean;
	streamError: string | null;
	selectedAgent: Agent | null;
	onMessageChange: (message: string) => void;
	onSendMessage: () => void;
}

export function ChatArea({
	messages,
	currentMessage,
	isLoading,
	streamError,
	selectedAgent,
	onMessageChange,
	onSendMessage,
}: ChatAreaProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// メッセージが追加されたら自動スクロール
	React.useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages]);

	return (
		<div className="flex-1 flex flex-col w-full overflow-hidden">
			<div className="flex-1 p-4 overflow-auto">
				<div className="space-y-4 max-w-4xl mx-auto">
					{messages.length === 0 ? (
						<div className="text-center text-muted-foreground py-8">
							メッセージを送信して会話を開始してください
						</div>
					) : (
						messages.map((chat, index) => (
							<ChatMessage
								key={index}
								message={chat}
								isLoading={
									isLoading && index === messages.length - 1
								}
								agentName={selectedAgent?.name}
							/>
						))
					)}
					{/* 自動スクロール用の参照 */}
					<div ref={messagesEndRef}></div>
				</div>
			</div>

			{/* エラーメッセージの表示 */}
			{streamError && (
				<div className="p-2 bg-red-50 border-t border-red-200 text-red-700 text-sm">
					<p>エラーが発生しました: {streamError}</p>
				</div>
			)}

			<div className="p-4 border-t">
				<div className="flex gap-2 max-w-4xl mx-auto">
					<Input
						value={currentMessage}
						onChange={(e) => onMessageChange(e.target.value)}
						placeholder="メッセージを入力..."
						onKeyDown={(e) =>
							e.key === "Enter" && !e.shiftKey && onSendMessage()
						}
						disabled={isLoading}
					/>
					<Button
						onClick={onSendMessage}
						disabled={isLoading || !currentMessage.trim()}
					>
						{isLoading ? "送信中..." : <Send className="h-4 w-4" />}
					</Button>
				</div>
			</div>
		</div>
	);
}
