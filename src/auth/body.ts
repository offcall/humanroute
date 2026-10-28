// Request body parsing for the auth routes.
import type { Context } from "hono";
import type { VerifyBody } from "./types.js";
import { decodeSignature, decodeWallet } from "./verify.js";

export type JsonBody = { ok: true; value: unknown } | { ok: false };

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const readJson = async (ctx: Context): Promise<JsonBody> => {
	if (!(ctx.req.header("content-type") ?? "").includes("application/json")) {
		return { ok: false };
	}
	try {
		const value: unknown = await ctx.req.json();
		return { ok: true, value };
	} catch {
		return { ok: false };
	}
};

export const parseNonceBody = (raw: unknown): string | null => {
	if (!isRecord(raw) || typeof raw.wallet !== "string") {
		return null;
	}
	return decodeWallet(raw.wallet) !== null ? raw.wallet : null;
};

export const parseVerifyBody = (raw: unknown): VerifyBody | null => {
	if (!isRecord(raw)) {
		return null;
	}
	const { wallet, nonce, signature } = raw;
	if (
		typeof wallet !== "string" ||
		typeof nonce !== "string" ||
		typeof signature !== "string"
	) {
		return null;
	}
	if (nonce.length < 1 || nonce.length > 100) {
		return null;
	}
	const publicKey = decodeWallet(wallet);
	const sig = decodeSignature(signature);
	if (publicKey === null || sig === null) {
		return null;
	}
	return { wallet, publicKey, nonce, signature: sig };
};
