// prepare_payment (ADR 0036): the gateway's offer plus the unsigned delegate payment, kept in memory.
import { formatUsdc } from "./money.js";
import type { PayClient, Prepared } from "./payTypes.js";
import { keepPrepared, PREPARED_TTL_MS } from "./pending.js";
import { toolText } from "./result.js";

const SIGN_COMMAND = "node ~/.humanroute/sign.mjs";

export const prepare = async (
	payClient: PayClient,
	token: string,
	draftId: string,
	now: number,
) => {
	const offer = await payClient.offer(draftId);
	if (!offer.ok) {
		return toolText(offer.error, true);
	}
	const feePayer = offer.value.accepted.extra?.feePayer;
	if (typeof feePayer !== "string") {
		return toolText("the gateway's payment offer has no fee payer", true);
	}
	const unsigned = await payClient.unsigned(token, draftId, feePayer);
	if (!unsigned.ok) {
		return toolText(unsigned.error, true);
	}
	const { accepted } = offer.value;
	if (
		unsigned.value.amountUnits !== accepted.amount ||
		unsigned.value.payTo !== accepted.payTo
	) {
		return toolText(
			"the unsigned payment does not match the gateway's offer; call prepare_payment again",
			true,
		);
	}
	const prepared: Prepared = {
		...unsigned.value,
		...offer.value,
		expiresAt: now + PREPARED_TTL_MS,
	};
	keepPrepared(token, draftId, prepared, now);

	return toolText(
		[
			`Amount: ${formatUsdc(prepared.amountUnits)} from the firm wallet's auto-pay allowance, signed by agent key ${prepared.signer}.`,
			"Run this command in the shell now; it checks the payment and prints a base64 signature:",
			`${SIGN_COMMAND} ${prepared.message}`,
			`Then call pay_task with draftId ${draftId} and that signature within ${PREPARED_TTL_MS / 1000} s.`,
		].join("\n"),
	);
};
