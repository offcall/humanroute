// Small parsers for single env values. Each returns the value or an error string.
import { PublicKey } from "@solana/web3.js";
import { Commitment, type Network, type Parsed } from "./types.js";

export const USDC_DECIMALS = 6;

const succeed = <T = unknown>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T = unknown>(error: string): Parsed<T> => ({ ok: false, error });

// "0.50" -> 500000n. At most 6 fractional digits.
export const parseUsdc = (name: string, raw: string): Parsed<bigint> => {
	const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(raw);
	if (!match) {
		return fail(
			`${name} must be a decimal amount with at most 6 decimals, got "${raw}"`,
		);
	}
	const whole = BigInt(match[1] ?? "0");
	const frac = BigInt((match[2] ?? "").padEnd(USDC_DECIMALS, "0"));
	return succeed(whole * 10n ** BigInt(USDC_DECIMALS) + frac);
};

// "10" or "2.5" percent -> basis points as bigint (1000n, 250n). Range 0..100.
export const parseFeeBps = (name: string, raw: string): Parsed<bigint> => {
	const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(raw);
	if (!match) {
		return fail(
			`${name} must be a percent with at most 2 decimals, got "${raw}"`,
		);
	}
	const bps =
		BigInt(match[1] ?? "0") * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
	return bps > 10_000n
		? fail(`${name} must be between 0 and 100`)
		: succeed(bps);
};

export const parseInteger = (
	name: string,
	raw: string,
	min: number,
	max: number,
): Parsed<number> => {
	if (!/^\d+$/.test(raw)) {
		return fail(`${name} must be an integer, got "${raw}"`);
	}
	const value = Number(raw);
	return value < min || value > max
		? fail(`${name} must be between ${min} and ${max}`)
		: succeed(value);
};

export const parseNetwork = (name: string, raw: string): Parsed<Network> => {
	const match = /^([a-z0-9-]+):([A-Za-z0-9]+)$/.exec(raw);
	if (!match) {
		return fail(
			`${name} must be a CAIP-2 id like solana:<genesis>, got "${raw}"`,
		);
	}
	const network: Network = `${match[1] ?? ""}:${match[2] ?? ""}`;
	return succeed(network);
};

export const parseCommitment = (
	name: string,
	raw: string,
): Parsed<Commitment> => {
	const found = Object.values(Commitment).find((level) => level === raw);
	if (found !== undefined) {
		return succeed(found);
	}
	return fail(`${name} must be confirmed or finalized, got "${raw}"`);
};

export const parseUrl = (name: string, raw: string): Parsed<string> => {
	try {
		const url = new URL(raw);
		if (url.protocol === "http:" || url.protocol === "https:") {
			return succeed(raw.replace(/\/+$/, ""));
		}
	} catch {}
	return fail(`${name} must be an http(s) URL, got "${raw}"`);
};

export const parsePubkey = (name: string, raw: string): Parsed<string> => {
	try {
		return succeed(new PublicKey(raw).toBase58());
	} catch {
		return fail(`${name} must be a base58 Solana address, got "${raw}"`);
	}
};

export const parseSecretValue = (name: string, raw: string): Parsed<string> =>
	raw.length >= 12
		? succeed(raw)
		: fail(`${name} is required (at least 12 characters)`);
