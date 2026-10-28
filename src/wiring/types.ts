import type { FacilitatorClient } from "@x402/core/server";
import type { SolanaClient } from "../chain/index.js";
import type { Config } from "../config/index.js";
import type { Database } from "../store/index.js";

export type WiringInput = {
	config: Config;
	database: Database;
	chain: SolanaClient;
	facilitator: FacilitatorClient;
	preflightProblems: () => string[];
	now: () => number;
	newId: () => string;
	log: (scope: string) => (msg: string) => void;
};
