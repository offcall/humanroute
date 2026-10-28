// Facilitator client and its preflight: GET /supported must list exact on our network.
import {
	type FacilitatorClient,
	HTTPFacilitatorClient,
} from "@x402/core/server";
import type { Network, PreflightProblem } from "../config/index.js";

export const createFacilitator = (url: string): FacilitatorClient =>
	new HTTPFacilitatorClient({ url });

export const checkFacilitator = async (
	facilitator: FacilitatorClient,
	url: string,
	network: Network,
): Promise<PreflightProblem[]> => {
	try {
		const supported = await facilitator.getSupported();
		const found = supported.kinds.some(
			(kind) => kind.scheme === "exact" && kind.network === network,
		);
		const reason = `facilitator does not support exact on ${network}`;
		return found ? [] : [{ reason, detail: `facilitator ${url}: ${reason}` }];
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		return [
			{
				reason: "facilitator /supported failed",
				detail: `facilitator ${url} /supported failed: ${error}`,
			},
		];
	}
};
