// Resolves sent transfers (ADR 0006). A signature is given up only when the chain does not know it,
// the block height is past its last_valid_block_height, and no hold transaction carries the memo.
import type { SolanaClient } from "../chain/index.js";
import { TransferStatus } from "../store/index.js";
import { fail, retry } from "./send.js";
import type { Expiry, Sendable, SendDeps } from "./types.js";

export const uncoveredReason = (createdAt: number): string =>
	`memo history of the hold wallet not covered back to ${createdAt}`;

// Call only after the chain reported the signature unknown. since: the row's created_at.
export const checkExpiry = async (
	chain: SolanaClient,
	memo: string,
	lastValidBlockHeight: number,
	since: number,
): Promise<Expiry> => {
	const height = await chain.blockHeight();
	if (!height.ok) {
		return { state: "unavailable", error: height.error.message };
	}
	if (height.value <= lastValidBlockHeight) {
		return { state: "live" };
	}

	const found = await chain.findMemo(memo, since);
	if (!found.ok) {
		return { state: "unavailable", error: found.error.message };
	}
	const search = found.value;
	if (search.state === "found") {
		return { state: "landed", signature: search.signature };
	}
	return { state: search.state === "absent" ? "expired" : "uncovered" };
};

const confirmFromMemo = async <T extends Sendable = Sendable>(
	deps: SendDeps<T>,
	transfer: T,
	signature: string,
): Promise<void> => {
	const status = await deps.chain.signatureStatus(signature);
	if (!status.ok || status.value.state !== "confirmed") {
		return;
	}
	deps.ledger.markConfirmed(transfer.id, signature, deps.now());
	deps.log(
		`transfer ${transfer.id} confirmed via memo ${transfer.memo} sig ${signature}`,
	);
};

export const checkSent = async <T extends Sendable = Sendable>(
	deps: SendDeps<T>,
	transfer: T,
): Promise<void> => {
	const { txSig, lastValidBlockHeight } = transfer;
	if (txSig === null || lastValidBlockHeight === null) {
		retry(deps, transfer, "sent row without signature or blockhash");
		return;
	}
	const status = await deps.chain.signatureStatus(txSig);
	if (!status.ok) {
		return deps.log(`status of ${txSig} unavailable: ${status.error.message}`);
	}
	const current = status.value;
	if (current.state === "confirmed") {
		deps.ledger.markConfirmed(transfer.id, txSig, deps.now());
		return deps.log(
			`transfer ${transfer.id} (${deps.describe(transfer)}) confirmed sig ${txSig}`,
		);
	}
	if (current.state === "failed") {
		return fail(
			deps,
			transfer,
			`on-chain error: ${current.error} sig ${txSig}`,
		);
	}
	if (current.state === "pending") {
		return;
	}

	const expiry = await checkExpiry(
		deps.chain,
		transfer.memo,
		lastValidBlockHeight,
		transfer.createdAt,
	);
	if (expiry.state === "landed") {
		await confirmFromMemo(deps, transfer, expiry.signature);
	} else if (expiry.state === "uncovered") {
		fail(deps, transfer, uncoveredReason(transfer.createdAt));
	} else if (expiry.state === "expired") {
		const error = `signature ${txSig} unseen after block height ${lastValidBlockHeight}`;
		retry(deps, transfer, error);
	}
};

export const recoverSent = async <T extends Sendable = Sendable>(
	deps: SendDeps<T>,
): Promise<void> => {
	for (const transfer of deps.ledger.listByStatus(TransferStatus.Sent)) {
		await checkSent(deps, transfer);
	}
};
