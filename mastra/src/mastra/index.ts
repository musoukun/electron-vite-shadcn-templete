import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core";

import { chatAgent, agents, getAgentsList } from "./agents";

const agentsToRegister = {};

if (chatAgent) {
	Object.assign(agentsToRegister, { chatAgent });
}

Object.assign(agentsToRegister, agents);

console.log("利用可能なエージェント:", getAgentsList());

export const mastra = new Mastra({
	agents: agentsToRegister,
	logger: createLogger({
		name: "Mastra",
		level: "info",
	}),
});
