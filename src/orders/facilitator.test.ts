// Facilitator preflight (failure table row 4): exact on the configured network, failures caught.
import { describe, expect, it } from "vitest";
import { fakeFacilitator, WALLETS } from "../testing/index.js";
import { checkFacilitator } from "./facilitator.js";

const URL = "http://facilitator.test";
const NETWORK = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

const facilitatorOn = (network: `${string}:${string}`, scheme = "exact") => {
	const fake = fakeFacilitator(
		network,
		WALLETS.facilitator.address,
		WALLETS.firm.address,
	);
	const supported = fake.answer.getSupported;
	fake.answer.getSupported = async () => {
		const answer = await supported();
		return {
			...answer,
			kinds: answer.kinds.map((kind) => ({ ...kind, scheme })),
		};
	};
	return fake;
};

describe("facilitator preflight", () => {
	it("NEW-05 facilitator readiness requires exact on the configured network and catches support failure", async () => {
		expect(
			await checkFacilitator(facilitatorOn(NETWORK), URL, NETWORK),
		).toEqual([]);

		const unsupported = `facilitator does not support exact on ${NETWORK}`;
		const problem = {
			reason: unsupported,
			detail: `facilitator ${URL}: ${unsupported}`,
		};
		const otherNetwork = facilitatorOn(
			"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		);
		expect(await checkFacilitator(otherNetwork, URL, NETWORK)).toEqual([
			problem,
		]);
		const otherScheme = facilitatorOn(NETWORK, "upto");
		expect(await checkFacilitator(otherScheme, URL, NETWORK)).toEqual([
			problem,
		]);

		const down = facilitatorOn(NETWORK);
		down.answer.getSupported = async () => {
			throw new Error("connect ECONNREFUSED");
		};
		expect(await checkFacilitator(down, URL, NETWORK)).toEqual([
			{
				reason: "facilitator /supported failed",
				detail: `facilitator ${URL} /supported failed: connect ECONNREFUSED`,
			},
		]);
	});
});
