import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
// LiteLLMのインポートを試験的なコメントとして扱う
// import { LiteLlm } from "litellm";

// プロバイダー型の定義
type Provider = "google" | "litellm";

// モデル情報の型定義
interface ModelInfo {
	id: string;
	name: string;
	provider: Provider;
	providerModelId?: string; // プロバイダー側でのモデルID（省略時はidと同じ）
}

// 使用するモデルのリスト - LiteLLMの利用がコメントアウトされているため、Googleモデルのみを有効化
const MODEL_LIST: ModelInfo[] = [
	// Google AI SDK モデル
	{
		id: "gemini-2.0-flash-001",
		name: "Gemini 2.0 Flash 001",
		provider: "google",
	},
	{
		id: "gemini-2.0-flash-exp",
		name: "Gemini 2.0 Flash Exp",
		provider: "google",
	},

	/* LiteLLM機能が有効になったら以下のコメントを外す
	// LiteLLM経由のモデル（OpenAI、Anthropicなど）
	// 環境変数 OPENAI_API_KEY が設定されている場合に有効
	{
		id: "gpt-4",
		name: "GPT-4 (OpenAI)",
		provider: "litellm",
		providerModelId: "openai/gpt-4",
	},
	{
		id: "gpt-4o",
		name: "GPT-4o (OpenAI)",
		provider: "litellm",
		providerModelId: "openai/gpt-4o",
	},
	
	// 環境変数 ANTHROPIC_API_KEY が設定されている場合に有効
	{
		id: "claude-3-opus",
		name: "Claude 3 Opus (Anthropic)",
		provider: "litellm",
		providerModelId: "anthropic/claude-3-opus-20240229",
	},
	{
		id: "claude-3-sonnet",
		name: "Claude 3 Sonnet (Anthropic)",
		provider: "litellm",
		providerModelId: "anthropic/claude-3-sonnet-20240229",
	},
	*/
];

// 共通の指示文
const COMMON_INSTRUCTIONS = `
	You are a helpful AI assistant that provides concise and informative responses.
	
	When responding:
	- Be friendly and helpful
	- Provide accurate information
	- Answer questions directly
	- If you don't know something, say so
	- Keep responses clear and to the point
`;

// APIキーが設定されているかどうかをチェック
function hasApiKey(provider: string): boolean {
	switch (provider) {
		case "openai":
			return !!process.env.OPENAI_API_KEY;
		case "anthropic":
			return !!process.env.ANTHROPIC_API_KEY;
		default:
			return true; // Google AIなど、APIキーが直接必要ないものはtrueを返す
	}
}

// モデルの利用可能性をチェック（APIキーの有無など）
function isModelAvailable(modelInfo: ModelInfo): boolean {
	if (modelInfo.provider === "litellm") {
		// LiteLLMがインポートされていない場合は利用不可
		return false; // インポートが解決したら条件を変更する

		// モデルIDからプロバイダー名を抽出（例: openai/gpt-4 → openai）
		// const providerName = modelInfo.providerModelId?.split('/')[0];
		// return providerName ? hasApiKey(providerName) : false;
	}

	return true; // その他のプロバイダーは常に利用可能とする
}

// プロバイダーに基づいてモデルインスタンスを取得する関数
function getModelInstance(modelInfo: ModelInfo): any {
	const modelId = modelInfo.providerModelId || modelInfo.id;

	switch (modelInfo.provider) {
		case "google":
			return google(modelId);
		case "litellm":
			// LiteLLMがインポートされていないため、エラーを投げる
			throw new Error(
				"LiteLLM機能は現在無効です。インポートを有効にしてください。"
			);
		// LiteLLMがインポートされたら以下のコードを使用
		// return new LiteLlm({ model: modelId });
		default:
			throw new Error(`未サポートのプロバイダー: ${modelInfo.provider}`);
	}
}

// 利用可能なモデルのみをフィルタリング
const availableModels = MODEL_LIST.filter(isModelAvailable);

// モデルリストからエージェントを動的に生成
const generatedAgents: Record<string, Agent> = {};

// 各モデルに対してエージェントを生成
availableModels.forEach((modelInfo) => {
	try {
		generatedAgents[modelInfo.id] = new Agent({
			name: modelInfo.name,
			instructions: COMMON_INSTRUCTIONS,
			model: getModelInstance(modelInfo),
		});
		console.log(
			`エージェント生成成功: ${modelInfo.name} (${modelInfo.id})`
		);
	} catch (error) {
		console.error(
			`エージェント生成失敗: ${modelInfo.name} (${modelInfo.id})`,
			error
		);
	}
});

// デフォルトのエージェントを設定（利用可能なら gemini-2.0-flash-exp、なければ最初の利用可能なモデル）
const defaultAgentId = generatedAgents["gemini-2.0-flash-exp"]
	? "gemini-2.0-flash-exp"
	: Object.keys(generatedAgents).length > 0
		? Object.keys(generatedAgents)[0]
		: null;

// 後方互換性のためにchatAgentを追加（利用可能なエージェントがある場合）
export const chatAgent = defaultAgentId
	? generatedAgents[defaultAgentId]
	: null;

// 個別のエージェントをエクスポート（便宜上、存在する場合のみ）
export const geminiFlash001Agent =
	generatedAgents["gemini-2.0-flash-001"] || null;
export const geminiFlashExpAgent =
	generatedAgents["gemini-2.0-flash-exp"] || null;

// すべてのエージェントをオブジェクトとしてエクスポート
export const agents = {
	...generatedAgents,
	...(chatAgent ? { chatAgent: chatAgent } : {}),
};

// エージェント一覧を取得する関数
export function getAgentsList() {
	return availableModels.map((model) => ({
		id: model.id,
		name: model.name,
		provider: model.provider,
		providerModel: model.providerModelId,
	}));
}

// 他のエージェントも必要に応じて追加
