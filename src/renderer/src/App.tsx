import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
} from "@/components/ui/card";
import { Send, Menu, User, Settings, RefreshCw } from "lucide-react";
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
	const [isModelSelectDialogOpen, setIsModelSelectDialogOpen] = useState(false);
	const [agents, setAgents] = useState<Agent[]>([]);
	const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
	const [selectedModel, setSelectedModel] = useState<string | null>(null);

	// 利用可能なエージェントを取得
	const fetchAgents = async () => {
		try {
			if (window.electronAPI?.getAgents) {
				const response = await window.electronAPI.getAgents();
				if (response && Array.isArray(response)) {
					setAgents(response);
					// デフォルトでchatAgentを選択（存在すれば）
					const defaultAgent = response.find(agent => agent.id === "chatAgent") || response[0];
					if (defaultAgent) {
						setSelectedAgent(defaultAgent);
					}
				}
			}
		} catch (error) {
			console.error("エージェント一覧の取得に失敗しました:", error);
		}
	};

	// 選択されたモデルを取得
	const getSelectedModel = async () => {
		try {
			if (window.electronAPI?.getSelectedModel) {
				const model = await window.electronAPI.getSelectedModel();
				setSelectedModel(model);
				return model;
			}
		} catch (error) {
			console.error("選択されたモデルの取得に失敗しました:", error);
		}
		return null;
	};

	// コンポーネントマウント時に初期化
	useEffect(() => {
		const initializeApp = async () => {
			await fetchAgents();
			await getSelectedModel();
		};
		
		initializeApp();
	}, []);

	// モデルが選択されたときの処理
	const handleModelSelect = async (modelId: string) => {
		try {
			if (window.electronAPI?.selectModel) {
				const result = await window.electronAPI.selectModel(modelId);
				if (result.success) {
					setSelectedModel(modelId);
					
					// モデル変更のシステムメッセージを表示
					const modelMessage = {
						role: "system",
						content: `モデルを「${modelId}」に変更しました。`,
					};
					setChatHistory((prev) => [...prev, modelMessage]);
				} else {
					// エラーメッセージを表示
					const errorMessage = {
						role: "system",
						content: `モデルの選択に失敗しました: ${result.message}`,
					};
					setChatHistory((prev) => [...prev, errorMessage]);
				}
			}
		} catch (error) {
			console.error("モデルの選択中にエラーが発生しました:", error);
			// エラーメッセージを表示
			const errorMessage = {
				role: "system",
				content: "モデルの選択中にエラーが発生しました。",
			};
			setChatHistory((prev) => [...prev, errorMessage]);
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
			// window.electronAPI が存在するか確認
			if (window.electronAPI?.sendMessageToLLM) {
				// 選択されたエージェントにメッセージを送信
				const response =
					await window.electronAPI.sendMessageToLLM(message, selectedAgent.id);

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
							{selectedModel && (
								<p className="text-xs text-muted-foreground mt-1">
									モデル: {selectedModel}
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
						{/* モデル選択ボタン */}
						<div className="p-4 border-t mt-auto">
							<Button
								variant="outline"
								className="w-full flex items-center justify-center gap-2"
								onClick={() => setIsModelSelectDialogOpen(true)}
							>
								<RefreshCw className="h-4 w-4" />
								<span>モデルを変更</span>
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
						
						{/* 現在のエージェントとモデルの表示 */}
						<div className="ml-auto flex items-center gap-2">
							{selectedAgent && (
								<div className="text-sm">
									エージェント: <span className="font-medium">{selectedAgent.name}</span>
								</div>
							)}
							{selectedModel && (
								<div className="text-sm ml-2">
									モデル: <span className="font-medium">{selectedModel}</span>
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
			
			{/* モデル選択ダイアログ */}
			<ModelSelectDialog
				open={isModelSelectDialogOpen}
				onOpenChange={setIsModelSelectDialogOpen}
				onModelSelect={handleModelSelect}
			/>
		</SidebarProvider>
	);
}

export default App;
