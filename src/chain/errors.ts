// Classifies RPC errors (section 4.4 of the review): retryable, final or ambiguous.
import { type ChainError, ErrorKind, Phase } from "./types.js";

const RETRYABLE = [/429/, /too many requests/i, /blockhash ?not ?found/i];
const FINAL = [
	/insufficient funds/i,
	/insufficient lamports/i,
	/custom program error: 0x1\b/i,
	/account ?not ?found/i,
	/could not find account/i,
	/invalid ?account ?data/i,
];

const messageOf = (err: unknown): string => {
	if (err instanceof Error) {
		return err.message;
	}
	return typeof err === "string" ? err : "unknown error";
};

// Phase.Prepare: nothing was broadcast, so anything unknown is retryable.
// Phase.Send: an unknown failure may still have reached a leader, so it is ambiguous.
export const classify = (err: unknown, phase: Phase): ChainError => {
	const message = messageOf(err).slice(0, 500);
	if (RETRYABLE.some((pattern) => pattern.test(message))) {
		return { kind: ErrorKind.Retryable, message };
	}
	if (FINAL.some((pattern) => pattern.test(message))) {
		return { kind: ErrorKind.Final, message };
	}
	if (phase === Phase.Send && /simulation failed/i.test(message)) {
		return { kind: ErrorKind.Final, message };
	}
	const kind =
		phase === Phase.Prepare ? ErrorKind.Retryable : ErrorKind.Ambiguous;
	return { kind, message };
};
