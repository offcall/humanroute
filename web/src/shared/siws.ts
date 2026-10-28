import { type ApiResult, request } from "./api";
import { isRecord, str } from "./parse";
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

const parseSignature = (raw: unknown): Uint8Array | undefined => {
	if (raw instanceof Uint8Array) {
		return raw;
	}

	return isRecord(raw) && raw.signature instanceof Uint8Array
		? raw.signature
		: undefined;
};

const fail = (error: string): ApiResult<never> => ({
	ok: false,
	status: 0,
	error: { error },
});

export const signIn = async (phantom: Phantom): Promise<ApiResult<true>> => {
	try {
		const wallet = parseWallet(await phantom.connect());
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
		const bytes = new TextEncoder().encode(nonce.value.message);
		const signed = parseSignature(await phantom.signMessage(bytes));
		if (signed === undefined) {
			return fail("sign_rejected");
		}

		return request(
			"POST",
			"/api/auth/verify",
			{ wallet, nonce: nonce.value.nonce, signature: toBase64(signed) },
			() => true,
		);
	} catch {
		return fail("sign_rejected");
	}
};
