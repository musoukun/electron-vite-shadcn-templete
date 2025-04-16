import { Agent } from "@mastra/core/agent";
import { MCPConfiguration } from "@mastra/mcp";
import { agentConfigs } from "./agents";

/**
 * マルチエージェント対応LLMクライアント
 * 複数のAIモデルを使用するエージェントを管理
 */

// MCP設定を作成
const mcp = new MCPConfiguration({
  id: "mastra-mcp",
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

/**
 * MCP通信を初期化する非同期関数
 * エージェント生成前にMCPとの接続を確立
 * @returns 初期化されたMCPツールオブジェクト
 */
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

/**
 * 設定から複数のエージェントを生成して管理するクラス
 */
class AgentManager {
  // 初期化したエージェントを保持する配列
  agents: Agent[] = [];
  
  /**
   * 設定配列からエージェントを初期化
   * @param configs エージェント設定の配列
   */
  constructor(configs = agentConfigs) {
    // 各設定からエージェントを生成
    this.agents = configs.map(config => new Agent({
      name: config.name,
      model: config.model,
      instructions: config.instructions,
      tools: {}, // 初期状態では空のツール設定
    }));
    
    console.log(`${this.agents.length}個のエージェントを初期化しました`);
  }
  
  /**
   * すべてのエージェントにMCPツールを設定
   * @param tools 設定するMCPツール
   */
  setToolsToAll(tools: Record<string, any>) {
    for (const agent of this.agents) {
      // @ts-ignore - tools プロパティは通常読み取り専用だが、初期化時に設定可能
      agent.tools = tools;
    }
    console.log(`${this.agents.length}個のエージェントにツールを設定しました`);
  }
  
  /**
   * 名前からエージェントを取得
   * @param name エージェント名
   * @returns 見つかったエージェント、または最初のエージェント
   */
  getAgent(name?: string): Agent {
    if (name) {
      const found = this.agents.find(agent => agent.name === name);
      if (found) return found;
    }
    // 指定したエージェントが見つからない場合は最初のエージェントを返す
    return this.agents[0];
  }
}

// エージェントマネージャーのインスタンスを作成
export const agentManager = new AgentManager();

// エクスポート用のエージェントリファレンスを作成
// 後方互換性のために最初のエージェントをデフォルトとしてエクスポート
export const geminiFlashAgent = agentManager.getAgent("Gemini Flash Experimental");

// エージェント初期化後にMCPツールを設定
(async () => {
  try {
    const mcpTools = await initMCP();
    
    // すべてのエージェントにツールを設定
    agentManager.setToolsToAll(mcpTools);
    
    console.log("すべてのエージェントを正常に初期化しました");
  } catch (error) {
    console.error("エージェント初期化中にエラーが発生しました:", error);
  }
})();

// すべてのエージェントをエクスポート
export const agents = agentManager.agents;
