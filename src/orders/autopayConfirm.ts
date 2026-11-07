// Waits for the firm's approve or revoke, sent by Phantom, to reach the gateway's commitment
// (ADR 0045), so the cabinet reads the new allowance once instead of guessing a delay.
import { base58 } from "@scure/base";
import type { OrdersDeps } from "./types.js";

export const CONFIRM_POLL_MS = 1000;
export const CONFIRM_POLLS = 30;

export enum ConfirmOutcome {
	Confirmed = "confirmed",
	Failed = "failed",
	NotConfirmed = "not_confirmed",
}

export type ConfirmResult =
	| { outcome: ConfirmOutcome.Confirmed | ConfirmOutcome.NotConfirmed }
	| { outcome: ConfirmOutcome.Failed; error: string };

export const isTxSignature = (value: string): boolean => {
	try {
		return base58.decode(value).length === 64;
	} catch {
		return false;
	}
};

// A chain read error or an unseen signature is retried until the polls run out or the caller leaves.
export const waitConfirmed = async (
	deps: Pick<OrdersDeps, "signatureStatusOf" | "sleep">,
	signature: string,
	signal: AbortSignal,
): Promise<ConfirmResult> => {
	for (let poll = 0; poll < CONFIRM_POLLS; poll += 1) {
		const read = await deps.signatureStatusOf(signature);
		if (read.ok && read.value.state === "confirmed") {
			return { outcome: ConfirmOutcome.Confirmed };
		}
		if (read.ok && read.value.state === "failed") {
			return { outcome: ConfirmOutcome.Failed, error: read.value.error };
		}
		try {
			await deps.sleep(CONFIRM_POLL_MS, signal);
		} catch {
			break;
		}
	}

	return { outcome: ConfirmOutcome.NotConfirmed };
};
