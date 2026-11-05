import { isRecord } from "../shared";

// x402 headers carry base64 JSON.
const decodeHeader = (value: string | null): unknown => {
	if (value === null) {
		return undefined;
	}
	try {
		return JSON.parse(atob(value));
	} catch {
		return undefined;
	}
};

const textOf = (value: unknown): string | undefined =>
	typeof value === "string" && value !== "" ? value : undefined;

// The x402 server puts a failed verify in PAYMENT-REQUIRED.error and a failed settle in
// PAYMENT-RESPONSE (errorReason, errorMessage).
export const paymentFailureReason = (headers: Headers): string | undefined => {
	const settle = decodeHeader(headers.get("PAYMENT-RESPONSE"));
	if (isRecord(settle) && settle.success === false) {
		const reason = textOf(settle.errorReason) ?? "unknown reason";
		const message = textOf(settle.errorMessage);
		const detail =
			message === undefined || message === reason ? "" : `: ${message}`;

		return `settle failed: ${reason}${detail}`;
	}

	const required = decodeHeader(headers.get("PAYMENT-REQUIRED"));
	const error = isRecord(required) ? textOf(required.error) : undefined;

	return error === undefined ? undefined : `verify failed: ${error}`;
};
