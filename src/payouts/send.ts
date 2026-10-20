// Sends one pending transfer: sign, persist signature + blockhash as sent, THEN broadcast.
// A crash after persisting leaves a sent row that recover.ts resolves by status and blockhash expiry.
import { ErrorKind } from "../chain/index.js";
import type { Transfer } from "../store/index.js";
import type { PayoutDeps } from "./types.js";

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

export const isDue = (transfer: Transfer, now: number): boolean => {
	if (transfer.attempts === 0) {
		return true;
	}
	const wait = Math.min(
		BASE_BACKOFF_MS * 2 ** transfer.attempts,
		MAX_BACKOFF_MS,
	);
	return now >= transfer.updatedAt + wait;
};

// Logged once: only the call that moves the row to failed reports it.
export const fail = (
	deps: PayoutDeps,
	transfer: Transfer,
	error: string,
): void => {
	if (!deps.store.transfers.markFailed(transfer.id, error, deps.now())) {
		return;
	}
	deps.log(
		`OPERATOR ACTION REQUIRED transfer ${transfer.id} job ${transfer.jobId}: ${error}`,
	);
};

// Back to pending with attempts + 1, or failed once the attempt budget is spent.
export const retry = (
	deps: PayoutDeps,
	transfer: Transfer,
	error: string,
): void => {
	const now = deps.now();
	const attempt = transfer.attempts + 1;
	if (attempt >= deps.maxAttempts) {
		fail(deps, transfer, `gave up after ${attempt} attempts: ${error}`);
		return;
	}
	deps.store.transfers.backToPending(transfer.id, error, now);
	deps.log(
		`transfer ${transfer.id} back to pending (attempt ${attempt}): ${error}`,
	);
};

export const sendPending = async (
	deps: PayoutDeps,
	transfer: Transfer,
): Promise<void> => {
	const signed = await deps.chain.signTransfer({
		toWallet: transfer.toWallet,
		amount: transfer.amount,
		memo: transfer.memo,
	});
	if (!signed.ok) {
		if (signed.error.kind === ErrorKind.Final) {
			fail(deps, transfer, signed.error.message);
		} else {
			retry(deps, transfer, signed.error.message);
		}
		return;
	}
	const txn = signed.value;
	const sent = {
		txSig: txn.signature,
		blockhash: txn.blockhash,
		lastValidBlockHeight: txn.lastValidBlockHeight,
	};
	if (!deps.store.transfers.markSent(transfer.id, sent, deps.now())) {
		return;
	}
	deps.log(
		`sending ${transfer.kind} ${transfer.amount} to ${transfer.toWallet} job ${transfer.jobId} sig ${txn.signature}`,
	);

	const res = await deps.chain.broadcast(txn.bytes);
	if (res.ok) {
		return;
	}
	// Rejected before forwarding: the signature can never land, so a fresh attempt is safe.
	if (res.error.kind === ErrorKind.Retryable) {
		retry(deps, transfer, res.error.message);
	} else if (res.error.kind === ErrorKind.Final) {
		fail(deps, transfer, res.error.message);
	} else {
		deps.log(
			`broadcast of ${txn.signature} ambiguous, waiting for status: ${res.error.message}`,
		);
	}
};
