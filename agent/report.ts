// Console output helpers for the demo agent. Prints only public data (job ids, signatures, URLs).
import type { JobStatus } from "./types.js";

export const explorerTx = (sig: string): string =>
	`https://explorer.solana.com/tx/${sig}?cluster=devnet`;

export const statusViewUrl = (statusUrl: string): string => {
	const url = new URL(statusUrl);
	url.pathname = `${url.pathname.replace(/\/$/, "")}/view`;
	return url.toString();
};

export const progressLine = (status: JobStatus): string => {
	const transfers =
		status.transfers
			.map((transfer) => `${transfer.kind}:${transfer.status}`)
			.join(",") || "-";
	return `${status.state}${status.viewed ? " (viewed)" : ""} transfers=${transfers}`;
};

export const printFinal = (status: JobStatus, payTx: string | null): void => {
	console.log(`\nfinal state: ${status.state}`);
	if (status.answer !== null) {
		console.log(`human answer: ${status.answer}`);
	}
	if (status.refundReason !== null) {
		console.log(`refund reason: ${status.refundReason}`);
	}
	if (payTx) {
		console.log(`  payment [confirmed] ${explorerTx(payTx)}`);
	}
	for (const transfer of status.transfers) {
		console.log(
			`  ${transfer.kind} [${transfer.status}] ${transfer.txSig ? explorerTx(transfer.txSig) : "(no tx yet)"}`,
		);
		if (transfer.status === "failed" && transfer.lastError) {
			console.log(`    last error: ${transfer.lastError}`);
		}
	}
};
