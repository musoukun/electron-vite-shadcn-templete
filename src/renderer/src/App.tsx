import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Send } from "lucide-react";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";

function App() {
	const [message, setMessage] = useState("");
	const [chatHistory, setChatHistory] = useState<
		{ role: string; content: string }[]
	>([]);
	const [isLoading, setIsLoading] = useState(false);

	const handleSendMessage = async () => {
		if (!message.trim() || isLoading) return;

		setIsLoading(true);

		// ユーザーメッセージをチャット履歴に追加
		const userMessage = { role: "user", content: message };
		setChatHistory((prev) => [...prev, userMessage]);

		try {
			// electronAPI.sendMessageToLLM は preload で定義されたもの
			const response = await window.electronAPI.sendMessageToLLM(message);

			// AIの応答をチャット履歴に追加
			const aiMessage = { role: "assistant", content: response };
			setChatHistory((prev) => [...prev, aiMessage]);

			// 入力フィールドをクリア
			setMessage("");
		} catch (error) {
			console.error("LLMとの通信中にエラーが発生しました:", error);

			// エラーメッセージをチャット履歴に追加
			const errorMessage = {
				role: "system",
				content:
					"エラーが発生しました。しばらくしてからもう一度お試しください。",
			};
			setChatHistory((prev) => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<SidebarProvider>
			<div className="flex h-screen w-full">
				<Sidebar className="w-64 border-r shrink-0" />

				<div className="flex-1 flex flex-col w-full overflow-hidden">
					<div className="p-4 border-b">
						<h1 className="text-xl font-bold">LLMクライアント</h1>
					</div>

					<div className="flex-1 p-4 overflow-auto">
						<div className="space-y-4 max-w-4xl mx-auto">
							{chatHistory.length === 0 ? (
								<div className="text-center text-muted-foreground py-8">
									メッセージを送信して会話を開始してください
								</div>
							) : (
								chatHistory.map((chat, index) => (
									<Card
										key={index}
										className={`${chat.role === "user" ? "bg-muted" : ""}`}
									>
										<CardHeader className="py-2">
											<CardTitle className="text-sm">
												{chat.role === "user"
													? "あなた"
													: chat.role === "assistant"
														? "AI"
														: "システム"}
											</CardTitle>
										</CardHeader>
										<CardContent className="py-2">
											{chat.content}
										</CardContent>
									</Card>
								))
							)}
						</div>
					</div>

					<div className="p-4 border-t">
						<div className="flex gap-2 max-w-4xl mx-auto">
							<Input
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								placeholder="メッセージを入力..."
								onKeyDown={(e) =>
									e.key === "Enter" && handleSendMessage()
								}
								disabled={isLoading}
							/>
							<Button
								onClick={handleSendMessage}
								disabled={isLoading}
							>
								{isLoading ? (
									"送信中..."
								) : (
									<Send className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</SidebarProvider>
	);
}

export default App;
