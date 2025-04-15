import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core";

import { chatAgent } from "./agents";

export const mastra = new Mastra({
	agents: { chatAgent },
	logger: createLogger({
		name: "Mastra",
		level: "info",
	}),
});
