import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Send, Menu, Settings, RefreshCw } from "lucide-react";
import {
	Sidebar,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { ModelSelectDialog } from "@/components/ModelSelectDialog";

// エージェントの型定義
interface Agent {
	id: string;
	name: string;
}

function App() {
	const [message, setMessage] = useState("");
	const [chatHistory, setChatHistory] = useState<
		{ role: string; content: string }[]
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isModelSelectDialogOpen, setIsModelSelectDialogOpen] =
		useState(false);
	const [agents, setAgents] = useState<Agent[]>([]);
	const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

	// 利用可能なエージェントを取得
	const fetchAgents = async () => {
		try {
			const response = await window.electronAPI?.getAgents();
			if (response && Array.isArray(response) && response.length > 0) {
				setAgents(response);
				setSelectedAgent(response[0]); // 最初のエージェントを選択
			}
		} catch (error) {
			console.error("エージェント一覧の取得に失敗:", error);
			setChatHistory([
				{
					role: "system",
					content: "エージェント情報の取得に失敗しました。",
				},
			]);
		}
	};

	// コンポーネントマウント時に初期化
	useEffect(() => {
		fetchAgents();
	}, []);

	// エージェントが選択されたときの処理
	const handleAgentSelect = async (agentId: string) => {
		try {
			// 選択されたエージェントを特定
			const agent = agents.find((a) => a.id === agentId);
			if (!agent) return;

			// 選択したエージェントをバックエンドに通知
			if (window.electronAPI?.selectModel) {
				await window.electronAPI.selectModel(agentId);
			}

			// UIを更新
			setSelectedAgent(agent);

			// エージェント変更のメッセージを表示
			setChatHistory((prev) => [
				...prev,
				{
					role: "system",
					content: `エージェントを「${agent.name}」に変更しました。`,
				},
			]);
		} catch (error) {
			console.error("エージェント選択エラー:", error);
		}
	};

	// メッセージ送信処理
	const handleSendMessage = async () => {
		if (!message.trim() || isLoading || !selectedAgent) return;

		setIsLoading(true);

		// ユーザーメッセージをチャット履歴に追加
		const userMessage = { role: "user", content: message };
		setChatHistory((prev) => [...prev, userMessage]);

		try {
			if (window.electronAPI?.sendMessageToLLM) {
				// 選択されたエージェントにメッセージを送信
				const response = await window.electronAPI.sendMessageToLLM(
					message,
					selectedAgent.id
				);

				// AIの応答をチャット履歴に追加
				setChatHistory((prev) => [
					...prev,
					{
						role: "assistant",
						content: response,
					},
				]);
			}
		} catch (error) {
			console.error("メッセージ送信エラー:", error);
			setChatHistory((prev) => [
				...prev,
				{
					role: "system",
					content: "メッセージの送信に失敗しました。",
				},
			]);
		} finally {
			setMessage("");
			setIsLoading(false);
		}
	};

	// 会話をクリア
	const clearConversation = () => {
		setChatHistory([]);
	};

	return (
		<SidebarProvider>
			<div className="flex h-screen w-full">
				<Sidebar className="w-64 border-r shrink-0">
					{/* サイドバーのコンテンツ */}
					<div className="flex flex-col h-full">
						<div className="p-4 border-b">
							<h2 className="text-lg font-semibold">会話</h2>
							{selectedAgent && (
								<p className="text-xs text-muted-foreground mt-1">
									エージェント: {selectedAgent.name}
								</p>
							)}
						</div>
						<div className="flex-1 overflow-auto p-2">
							{/* 会話履歴のリストをここに表示 */}
							<div className="space-y-1">
								<Button
									variant="ghost"
									className="w-full justify-start"
									onClick={clearConversation}
								>
									<span>会話をクリア</span>
								</Button>
							</div>
						</div>
						{/* エージェント選択ボタン */}
						<div className="p-4 border-t mt-auto">
							<Button
								variant="outline"
								className="w-full flex items-center justify-center gap-2"
								onClick={() => setIsModelSelectDialogOpen(true)}
							>
								<RefreshCw className="h-4 w-4" />
								<span>エージェントを変更</span>
							</Button>
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

						{/* 現在のエージェントの表示 */}
						<div className="ml-auto flex items-center gap-2">
							{selectedAgent && (
								<div className="text-sm">
									エージェント:{" "}
									<span className="font-medium">
										{selectedAgent.name}
									</span>
								</div>
							)}
						</div>
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
										className={`${chat.role === "user" ? "bg-muted" : chat.role === "system" ? "bg-blue-50 border-blue-200" : ""}`}
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
								disabled={
									isLoading ||
									!message.trim() ||
									!selectedAgent
								}
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

			{/* エージェント選択ダイアログ */}
			<ModelSelectDialog
				open={isModelSelectDialogOpen}
				onOpenChange={setIsModelSelectDialogOpen}
				onModelSelect={handleAgentSelect}
			/>
		</SidebarProvider>
	);
}

export default App;
