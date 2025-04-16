import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core/logger";
import { geminiFlashAgent } from "./agents";

/**
 * Mastraメインモジュール
 * アプリケーションのエントリーポイント
 */

// Mastraインスタンスの作成（エージェントを直接指定）
export const mastra: Mastra = new Mastra({
	agents: {
		geminiFlashAgent, // エージェントをオブジェクト形式で直接登録
	},
	logger: createLogger({
		name: "Mastra",
		level: "info",
	}),
});

/**
 * メッセージを処理する関数
 * ユーザーからのメッセージをエージェントに送信し、応答を返す
 * @param message 処理するメッセージ
 * @returns エージェントの応答
 */
export async function processMessage(message: string): Promise<string> {
	try {
		console.log(`メッセージを処理します: ${message}`);

		// エージェントを直接取得（事前に登録済み）
		const agent = await mastra.getAgent("geminiFlashAgent");

		if (!agent) {
			return "エージェントが見つかりません";
		}

		// メッセージを生成
		const response = await agent.generate(message);
		return response.text;
	} catch (error) {
		console.error("メッセージ処理中にエラーが発生しました:", error);
		return `エラーが発生しました: ${error.message || error}`;
	}
}

// エクスポート
export { geminiFlashAgent };
