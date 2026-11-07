// Starts the localnet stack outside Vitest and keeps it up until Ctrl-C, for the smoke project
// or manual checks: `node --import tsx e2e/env/serve.ts`. Prints the SMOKE_* variables, with an
// MCP token of a firm registered on the first funded wallet.
import { Keypair } from "@solana/web3.js";
import type { TestProject } from "vitest/node";
import { registerFirm } from "../support/people.js";
import setup from "./localnet.setup.js";
import type { E2eEnv } from "./types.js";

let provided: E2eEnv | undefined;
const project: Pick<TestProject, "provide"> = {
	provide: (_key, value) => {
		provided = value;
	},
};

const teardown = await setup(project);
if (provided === undefined) {
	throw new Error("the setup provided no environment");
}
const secret = provided.firms[0] ?? [];
const firm = await registerFirm(
	provided.gatewayUrl,
	Keypair.fromSecretKey(Uint8Array.from(secret)),
);
console.log(`SMOKE_GATEWAY_URL=${provided.gatewayUrl}`);
console.log(`SMOKE_MCP_URL=${provided.mcpUrl}`);
console.log(`SMOKE_MCP_TOKEN=${firm.mcpToken}`);
console.log("ready; Ctrl-C stops and removes everything");

const stop = (): void => {
	teardown().finally(() => process.exit(0));
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
