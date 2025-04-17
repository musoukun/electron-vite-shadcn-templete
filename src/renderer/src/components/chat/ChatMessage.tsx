import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChatMessage as ChatMessageType } from "@/types/chat";

interface ChatMessageProps {
	message: ChatMessageType;
	isLoading?: boolean;
	agentName?: string;
}

export function ChatMessage({
	message,
	isLoading,
	agentName,
}: ChatMessageProps) {
	return (
		<Card className={`${message.role === "user" ? "bg-muted" : ""}`}>
			<CardHeader className="py-2">
				<CardTitle className="text-sm">
					{message.role === "user"
						? "あなた"
						: message.role === "assistant"
							? agentName || "AI"
							: "システム"}
				</CardTitle>
			</CardHeader>
			<CardContent className="py-2 whitespace-pre-wrap">
				{message.content}
				{isLoading && message.role === "assistant" && (
					<span className="animate-pulse">▌</span>
				)}
			</CardContent>
		</Card>
	);
}
