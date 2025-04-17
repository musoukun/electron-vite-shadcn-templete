import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Agent, Message } from "@/types";
import { SendIcon } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

interface ChatAreaProps {
	messages: Message[];
	selectedAgent: Agent | null;
	isLoadingMessages: boolean;
	onSendMessage: (content: string) => void;
}

export function ChatArea({
	messages,
	selectedAgent,
	isLoadingMessages,
	onSendMessage,
}: ChatAreaProps) {
	const [messageInput, setMessageInput] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	const handleSendMessage = (e: FormEvent) => {
		e.preventDefault();
		if (messageInput.trim() && selectedAgent) {
			onSendMessage(messageInput);
			setMessageInput("");
		}
	};

	return (
		<div className="flex flex-1 flex-col">
			<div className="flex flex-1 flex-col overflow-y-auto p-4">
				{isLoadingMessages ? (
					<div className="flex items-center justify-center py-4">
						<span className="text-sm text-muted-foreground">
							メッセージを読み込み中...
						</span>
					</div>
				) : messages.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center">
						<span className="text-sm text-muted-foreground">
							{selectedAgent
								? `${selectedAgent.name}に質問してみましょう`
								: "エージェントを選択してください"}
						</span>
					</div>
				) : (
					<div className="space-y-4">
						{messages.map((message) => (
							<div
								key={message.id}
								className={`flex ${
									message.role === "user"
										? "justify-end"
										: "justify-start"
								}`}
							>
								<div
									className={`max-w-[80%] rounded-lg p-3 ${
										message.role === "user"
											? "bg-primary text-primary-foreground"
											: "bg-muted"
									}`}
								>
									<p className="whitespace-pre-wrap">
										{message.content}
									</p>
								</div>
							</div>
						))}
						<div ref={messagesEndRef} />
					</div>
				)}
			</div>

			<div className="border-t p-4">
				<form onSubmit={handleSendMessage} className="flex gap-2">
					<Textarea
						value={messageInput}
						onChange={(e) => setMessageInput(e.target.value)}
						placeholder={
							selectedAgent
								? `${selectedAgent.name}に質問する...`
								: "エージェントを選択してください"
						}
						className="min-h-[60px] flex-1 resize-none"
						disabled={!selectedAgent}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSendMessage(e);
							}
						}}
					/>
					<Button
						type="submit"
						disabled={!messageInput.trim() || !selectedAgent}
						size="icon"
					>
						<SendIcon className="h-4 w-4" />
					</Button>
				</form>
			</div>
		</div>
	);
}
