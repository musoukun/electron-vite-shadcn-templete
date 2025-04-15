import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";

export const chatAgent = new Agent({
	name: "Chat Agent",
	instructions: `
      You are a helpful AI assistant that provides concise and informative responses.
      
      When responding:
      - Be friendly and helpful
      - Provide accurate information
      - Answer questions directly
      - If you don't know something, say so
      - Keep responses clear and to the point
    `,
	model: google("gemini-2.0-flash-exp"), // デフォルトモデル
});

// 他のエージェントも必要に応じて追加
