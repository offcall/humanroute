// Gateway preflight: hold wallet and mint on the chain plus the facilitator, re-checked every
// interval. A failure never stops the process (ADR 0008).
import type { FacilitatorClient } from "@x402/core/server";
import type { SolanaClient } from "./chain/index.js";
import type { Config, PreflightProblem } from "./config/index.js";
import { checkFacilitator } from "./orders/index.js";
import { log, type PreflightWatch, watchPreflight } from "./startup.js";

const PREFLIGHT_INTERVAL_MS = 60_000;

export const startPreflight = (
	config: Config,
	chain: SolanaClient,
	facilitator: FacilitatorClient,
): Promise<PreflightWatch> => {
	const { facilitatorUrl, network } = config;
	const check = async (): Promise<PreflightProblem[]> => [
		...(await chain.preflight()),
		...(await checkFacilitator(facilitator, facilitatorUrl, network)),
	];
	return watchPreflight(check, log("preflight"), PREFLIGHT_INTERVAL_MS);
};
