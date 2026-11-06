import { setTimeout } from "node:timers/promises";
import { SESSION_COOKIE } from "../auth/index.js";
import type { OrdersDeps } from "../orders/index.js";
import { transferViewOf } from "../payouts/index.js";
import type { peopleDeps } from "./people.js";
import type { WiringInput } from "./types.js";

export const ordersDeps = (
	input: WiringInput,
	people: ReturnType<typeof peopleDeps>,
): OrdersDeps => {
	const { config, database } = input;
	return {
		database,
		facilitator: input.facilitator,
		network: config.network,
		usdcMint: config.usdcMint,
		payTo: input.chain.holdAddress,
		taskPriceUnits: config.taskPriceUnits,
		claimWindowSeconds: config.claimWindowSeconds,
		draftTtlSeconds: config.draftTtlSeconds,
		publicBaseUrl: config.publicBaseUrl,
		sessionCookie: SESSION_COOKIE,
		...people,
		firmWallet: (firmId) => {
			const firm = people.firmById(firmId);
			return firm === null ? null : firm.wallet;
		},
		tokenAccountOf: async (owner) => {
			const read = await input.chain.tokenAccount(owner);
			return read.ok ? read : { ok: false, error: read.error.message };
		},
		solBalanceOf: async (owner) => {
			const read = await input.chain.solBalance(owner);
			return read.ok ? read : { ok: false, error: read.error.message };
		},
		latestBlockhash: async () => {
			const read = await input.chain.latestBlockhash();
			return read.ok ? read : { ok: false, error: read.error.message };
		},
		transferOf: transferViewOf(database),
		preflightProblems: input.preflightProblems,
		now: input.now,
		sleep: (millis, signal) =>
			setTimeout(millis, undefined, { signal, ref: false }),
		newId: input.newId,
		log: input.log("orders"),
	};
};
