import { type ApiResult, request } from "./api";
import { isRecord, str } from "./parse";
import {
	describeShape,
	errorCode,
	errorText,
	parseSignature,
} from "./signature";
import { type Phantom, toBase64 } from "./wallet";

type Challenge = { nonce: string; message: string };

const parseChallenge = (raw: unknown): Challenge | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const nonce = str(raw.nonce);
	const message = str(raw.message);

	return nonce === undefined || message === undefined
		? undefined
		: { nonce, message };
};

const parseWallet = (raw: unknown): string | undefined => {
	if (!isRecord(raw) || !isRecord(raw.publicKey)) {
		return undefined;
	}

	return String(raw.publicKey);
};

const fail = (error: string): ApiResult<never> => ({
	ok: false,
	status: 0,
	error: { error },
});

const REJECTED_CODE = 4001;

// The signed proof goes to /api/auth/verify, or to a login request approve (ADR 0034).
export const signIn = async (
	phantom: Phantom,
	path = "/api/auth/verify",
): Promise<ApiResult<true>> => {
	let connected: unknown;
	try {
		connected = await phantom.connect();
	} catch (err) {
		return fail(`connect_failed: ${errorText(err)}`);
	}
	const wallet = parseWallet(connected);
	if (wallet === undefined) {
		return fail("wallet_unavailable");
	}
	const nonce = await request(
		"POST",
		"/api/auth/nonce",
		{ wallet },
		parseChallenge,
	);
	if (!nonce.ok) {
		return nonce;
	}

	let raw: unknown;
	try {
		raw = await phantom.signMessage(
			new TextEncoder().encode(nonce.value.message),
		);
	} catch (err) {
		return errorCode(err) === REJECTED_CODE
			? fail("sign_rejected")
			: fail(`sign_failed: ${errorText(err)}`);
	}
	const signed = parseSignature(raw);
	if (signed === undefined) {
		return fail(`bad_signature_shape: ${describeShape(raw)}`);
	}

	return request(
		"POST",
		path,
		{ wallet, nonce: nonce.value.nonce, signature: toBase64(signed) },
		() => true,
	);
};
