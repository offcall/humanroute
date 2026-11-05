import { SESSION_COOKIE } from "../auth/index.js";
import { createPushSender, type NotifyDeps } from "../notify/index.js";
import type { peopleDeps } from "./people.js";
import type { WiringInput } from "./types.js";

// Push is off (no key, no sender) when the VAPID env is empty (ADR 0029).
export const notifyDeps = (
	input: WiringInput,
	people: ReturnType<typeof peopleDeps>,
): NotifyDeps => {
	const { config } = input;
	return {
		database: input.database,
		now: input.now,
		sessionCookie: SESSION_COOKIE,
		lookupSession: people.lookupSession,
		publicKey: config.vapid === null ? null : config.vapid.publicKey,
		sender: config.vapid === null ? null : createPushSender(config.vapid),
		claimWindowSeconds: config.claimWindowSeconds,
		log: input.log("notify"),
	};
};
