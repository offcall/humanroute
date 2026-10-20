// Operator requeue: failed -> pending, only when no earlier signature can still land (ADR 0006).
// Sends nothing; the worker picks the pending row up. attempts is kept.
import { type Transfer, TransferStatus } from "../store/index.js";
import { checkExpiry } from "./recover.js";
import type { RequeueDeps, RequeueResult } from "./types.js";

const refuse = (reason: string): RequeueResult => ({
	outcome: "refused",
	reason,
});

// null when the transfer may be sent again, else why not.
const blocker = async (
	deps: RequeueDeps,
	transfer: Transfer,
): Promise<RequeueResult | null> => {
	const { txSig, lastValidBlockHeight, memo } = transfer;
	if (txSig === null) {
		return null;
	}
	if (lastValidBlockHeight === null) {
		return refuse(`signature ${txSig} has no last_valid_block_height`);
	}

	const status = await deps.chain.signatureStatus(txSig);
	if (!status.ok) {
		return { outcome: "error", error: status.error.message };
	}
	if (status.value.state !== "unknown") {
		return refuse(`chain reports ${txSig} as ${status.value.state}`);
	}

	const expiry = await checkExpiry(deps.chain, memo, lastValidBlockHeight);
	switch (expiry.state) {
		case "expired":
			return null;
		case "live":
			return refuse(
				`block height not past ${lastValidBlockHeight}; ${txSig} may still land`,
			);
		case "landed":
			return refuse(`memo ${memo} found in ${expiry.signature}`);
		case "unavailable":
			return { outcome: "error", error: expiry.error };
	}
};

export const requeueTransfer = async (
	deps: RequeueDeps,
	idOrJobId: string,
): Promise<RequeueResult> => {
	const found = deps.store.find(idOrJobId);
	if (!found) {
		return refuse(`no transfer with id or job id ${idOrJobId}`);
	}
	if (found.status !== TransferStatus.Failed) {
		return refuse(`transfer ${found.id} is ${found.status}, not failed`);
	}

	const blocked = await blocker(deps, found);
	if (blocked) {
		return blocked;
	}
	if (!deps.store.requeue(found.id, deps.now())) {
		return refuse(`transfer ${found.id} changed status during the check`);
	}

	const requeued = deps.store.find(found.id);
	if (!requeued) {
		return { outcome: "error", error: `transfer ${found.id} vanished` };
	}
	return { outcome: "requeued", transfer: requeued };
};
