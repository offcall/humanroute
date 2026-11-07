// pay_task (ADR 0036): puts the agent's signature into the prepared payment and sends it over x402.
import { formatUsdc } from "./money.js";
import { WAIT_AFTER_PAYMENT } from "./paymentNext.js";
import { type PayClient, PayOutcome } from "./payTypes.js";
import { dropPrepared, takePrepared } from "./pending.js";
import { toolText } from "./result.js";
import { signedTransaction } from "./signature.js";

export const pay = async (
	payClient: PayClient,
	token: string,
	draftId: string,
	signature: string,
	now: number,
) => {
	const prepared = takePrepared(token, draftId, now);
	if (prepared === undefined) {
		return toolText(
			"no prepared payment for this draft, or it expired: call prepare_payment again",
			true,
		);
	}
	const transaction = signedTransaction(prepared, signature);
	if (!transaction.ok) {
		return toolText(transaction.error, true);
	}
	// PAYMENT-SIGNATURE: base64 JSON of the x402 v2 payload, echoing the gateway's own offer.
	const payload = {
		x402Version: 2,
		resource: prepared.resource,
		accepted: prepared.accepted,
		payload: { transaction: transaction.value },
	};
	const header = Buffer.from(JSON.stringify(payload), "utf8").toString(
		"base64",
	);
	const paid = await payClient.pay(draftId, header);
	if (!paid.ok) {
		return toolText(`${paid.error}.`, true);
	}
	dropPrepared(token, draftId);
	if (paid.value.outcome === PayOutcome.AlreadyPaid) {
		return toolText(
			`This draft is already paid. Do not pay again. ${WAIT_AFTER_PAYMENT}`,
		);
	}
	const { orderId, payTx } = paid.value.order;
	return toolText(
		`Paid: you signed the payment of ${formatUsdc(prepared.amountUnits)}. orderId ${orderId}, payTx ${payTx} (Solana devnet). Tell the user you signed it, with the payTx. ${WAIT_AFTER_PAYMENT}`,
	);
};
