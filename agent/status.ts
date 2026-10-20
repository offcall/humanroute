// pollStatus(): GET the status URL every 2 s until the job is released/refunded and its
// terminal transfer has settled (confirmed or failed), until the payout is still releasing/refunding
// but its transfer failed (operator action needed), or until the timeout.
import { parseStatus } from "./parse.js";
import type { JobStatus, PollOptions } from "./types.js";

const TERMINAL_TRANSFER: Record<string, string> = {
	released: "release",
	refunded: "refund",
};

const IN_PROGRESS_TRANSFER: Record<string, string> = {
	releasing: "release",
	refunding: "refund",
};

export const isDone = (status: JobStatus): boolean => {
	const stuck = IN_PROGRESS_TRANSFER[status.state];
	if (stuck !== undefined) {
		return status.transfers.some(
			(transfer) => transfer.kind === stuck && transfer.status === "failed",
		);
	}
	const kind = TERMINAL_TRANSFER[status.state];
	if (kind === undefined) {
		return false;
	}
	return status.transfers.some(
		(transfer) =>
			transfer.kind === kind &&
			(transfer.status === "confirmed" || transfer.status === "failed"),
	);
};

const sleep = (delayMs: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, delayMs));

const fetchStatus = async (
	statusUrl: string,
): Promise<JobStatus | undefined> => {
	const res = await fetch(statusUrl);
	if (res.status === 404) {
		throw new Error("status 404: unknown job or bad token");
	}
	if (!res.ok) {
		return undefined;
	}
	const parsed = parseStatus(await res.json());
	if (!parsed.ok) {
		throw new Error(`malformed status response: ${parsed.error}`);
	}
	return parsed.value;
};

export const pollStatus = async (
	statusUrl: string,
	opts: PollOptions = {},
): Promise<JobStatus> => {
	const interval = opts.intervalMs ?? 2000;
	const until = Date.now() + (opts.timeoutMs ?? 10 * 60_000);
	for (;;) {
		const status = await fetchStatus(statusUrl);
		if (status) {
			opts.onTick?.(status);
			if (isDone(status)) {
				return status;
			}
		}
		if (Date.now() > until) {
			throw new Error("timed out waiting for the job to finish");
		}
		await sleep(interval);
	}
};
