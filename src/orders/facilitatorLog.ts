// Wraps the facilitator so each failed verify or settle logs one line with its reason.
// Public data only: draft id (from the paid resource URL), payer, reason.
import type { FacilitatorClient } from "@x402/core/server";
import type { PaymentPayload } from "@x402/core/types";

type Failure = { payer: string | undefined; reason: string };

const draftIdOf = (payload: PaymentPayload): string =>
	payload.resource?.url.split("/").pop() ?? "unknown";

// VerifyError / SettleError carry the facilitator's reason in the message and the payer as a field.
const thrown = (error: unknown): Failure => {
	const payer: unknown =
		typeof error === "object" && error !== null
			? Reflect.get(error, "payer")
			: undefined;
	return {
		payer: typeof payer === "string" ? payer : undefined,
		reason: error instanceof Error ? error.message : String(error),
	};
};

const joined = (reason: string | undefined, message: string | undefined) =>
	[reason ?? "unknown reason", message].filter(Boolean).join(": ");

export const loggedFacilitator = (
	facilitator: FacilitatorClient,
	log: (msg: string) => void,
): FacilitatorClient => {
	const report = (step: string, payload: PaymentPayload, failure: Failure) =>
		log(
			`x402 ${step} failed draft=${draftIdOf(payload)} payer=${failure.payer || "unknown"} reason=${failure.reason}`,
		);

	return {
		getSupported: () => facilitator.getSupported(),
		verify: async (payload, requirements) => {
			try {
				const result = await facilitator.verify(payload, requirements);
				if (!result.isValid) {
					const reason = joined(result.invalidReason, result.invalidMessage);
					report("verify", payload, { payer: result.payer, reason });
				}
				return result;
			} catch (error) {
				report("verify", payload, thrown(error));
				throw error;
			}
		},
		settle: async (payload, requirements) => {
			try {
				const result = await facilitator.settle(payload, requirements);
				if (!result.success) {
					const reason = joined(result.errorReason, result.errorMessage);
					report("settle", payload, { payer: result.payer, reason });
				}
				return result;
			} catch (error) {
				report("settle", payload, thrown(error));
				throw error;
			}
		},
	};
};
