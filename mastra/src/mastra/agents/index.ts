import { Agent } from "@mastra/core/agent";
import { google } from "@ai-sdk/google";
import { MCPConfiguration } from "@mastra/mcp";

/**
 * エージェント定義モジュール
 * Gemini Flash Experimentalモデルを使用するエージェントを定義
 */

// 基本指示文
const baseInstructions = `
あなたは高性能な会話エージェントです。
ユーザーの質問に対して、簡潔かつ正確な回答を提供してください。

【基本的な応答方針】
- ユーザーの質問や要求を正確に理解し、適切に応答してください
- 回答は簡潔でわかりやすく構成してください
- わからないことには正直に「わかりません」と答えてください
- 利用可能なツールがある場合は、それらを適切に活用して回答の質を高めてください

【ツール使用について】
- ツールが利用可能な場合は、適切なタイミングでツールを使用してください
- ツールの使用前に、必要なパラメータを適切に設定してください
- ツールの結果を適切に解釈し、ユーザーにわかりやすく説明してください
`;

// MCP設定を作成
const mcp = new MCPConfiguration({
	id: "gemini-flash-mcp",
	servers: {
		"brave-search": {
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-brave-search"],
			env: {
				BRAVE_API_KEY: "BSA_shGcgIJnHv9pNaFaQ6GHXGbaJMW",
			},
		},
	},
});

// MCP通信を事前に初期化する非同期関数
// このようにすることで、エージェント生成前にMCPとの接続を確立できる
async function initMCP() {
	try {
		console.log("MCPツールを初期化しています...");
		const tools = await mcp.getTools();
		console.log(
			`${Object.keys(tools).length}個のMCPツールを初期化しました`
		);
		return tools;
	} catch (error) {
		console.error("MCPツール初期化中にエラーが発生しました:", error);
		return {}; // エラーが発生しても空のオブジェクトを返す
	}
}

// エージェントを初期化し、エクスポート（即時実行関数で非同期処理を実行）
export const geminiFlashAgent = new Agent({
	name: "Gemini Flash Experimental",
	model: google("gemini-2.0-flash-exp"),
	instructions: baseInstructions,
	// MCPツールを空のオブジェクトで初期化し、後から非同期で取得したツールを設定
	tools: {},
});

// エージェント初期化後にMCPツールを設定
// すぐに実行されるが、エージェントの初期化は非同期に行われる
(async () => {
	try {
		const mcpTools = await initMCP();

		// すでに作成したエージェントにツールを設定
		// @ts-ignore - tools プロパティは通常読み取り専用だが、初期化時に設定可能
		geminiFlashAgent.tools = mcpTools;

		console.log("Gemini Flash エージェントを正常に初期化しました");
	} catch (error) {
		console.error("エージェント初期化中にエラーが発生しました:", error);
	}
})();
