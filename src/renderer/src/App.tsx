import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Send, Menu, User, Settings } from "lucide-react";
import {
	Sidebar,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { ApiKeyDialog } from "@/components/ApiKeyDialog";

function App() {
	const [message, setMessage] = useState("");
	const [chatHistory, setChatHistory] = useState<
		{ role: string; content: string }[]
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);

	// APIキー更新イベントのリスナーを設定
	useEffect(() => {
		// window.electronAPI が存在するか確認してから処理を実行
		if (window.electronAPI?.onApiKeyUpdate) {
			const unsubscribe = window.electronAPI.onApiKeyUpdate((result) => {
				if (result.success) {
					// 成功メッセージを表示
					const successMessage = {
						role: "system",
						content: "APIキーが正常に設定されました。",
					};
					setChatHistory((prev) => [...prev, successMessage]);
				} else {
					// エラーメッセージを表示
					const errorMessage = {
						role: "system",
						content: `APIキーの設定に失敗しました: ${result.message}`,
					};
					setChatHistory((prev) => [...prev, errorMessage]);
				}
			});

			return () => {
				if (unsubscribe) unsubscribe();
			};
		}
		// electronAPI が存在しない場合は何もしない
		return undefined;
	}, []);

	const handleSendMessage = async () => {
		if (!message.trim() || isLoading) return;

		setIsLoading(true);

		// ユーザーメッセージをチャット履歴に追加
		const userMessage = { role: "user", content: message };
		setChatHistory((prev) => [...prev, userMessage]);

		try {
			// window.electronAPI が存在するか確認
			if (window.electronAPI?.sendMessageToLLM) {
				// LLMにメッセージを送信
				const response =
					await window.electronAPI.sendMessageToLLM(message);

				// AIの応答をチャット履歴に追加
				const aiMessage = { role: "assistant", content: response };
				setChatHistory((prev) => [...prev, aiMessage]);
			} else {
				// 開発環境用のダミー応答
				const dummyResponse = {
					role: "assistant",
					content:
						"開発環境では応答をシミュレートしています。Electron APIが利用できません。",
				};
				setChatHistory((prev) => [...prev, dummyResponse]);
			}

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
				<Sidebar className="w-64 border-r shrink-0">
					{/* サイドバーのコンテンツ */}
					<div className="flex flex-col h-full">
						<div className="p-4 border-b">
							<h2 className="text-lg font-semibold">会話履歴</h2>
						</div>
						<div className="flex-1 overflow-auto p-2">
							{/* 会話履歴のリストをここに表示 */}
							<div className="space-y-1">
								<Button
									variant="ghost"
									className="w-full justify-start"
								>
									<span>新しい会話</span>
								</Button>
								{/* 過去の会話リスト（サンプル） */}
								<Button
									variant="ghost"
									className="w-full justify-start text-sm"
								>
									<span>会話 1</span>
								</Button>
								<Button
									variant="ghost"
									className="w-full justify-start text-sm"
								>
									<span>会話 2</span>
								</Button>
							</div>
						</div>
						{/* アカウント情報 */}
						<div className="p-4 border-t mt-auto">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
										<User size={16} />
									</div>
									<div>
										<p className="text-sm font-medium">
											ユーザー
										</p>
										<p className="text-xs text-muted-foreground">
											Gemini Pro
										</p>
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setIsApiKeyDialogOpen(true)}
								>
									<Settings className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>
				</Sidebar>

				<div className="flex-1 flex flex-col w-full overflow-hidden">
					<div className="p-4 border-b flex items-center">
						<SidebarTrigger>
							<Button
								variant="ghost"
								size="icon"
								className="mr-2"
							>
								<Menu className="h-5 w-5" />
							</Button>
						</SidebarTrigger>
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

			<ApiKeyDialog
				open={isApiKeyDialogOpen}
				onOpenChange={setIsApiKeyDialogOpen}
			/>
		</SidebarProvider>
	);
}

export default App;
