// Request bodies of the push routes. Each parser returns the value or null.
import type { Context } from "hono";
import type { PushTarget } from "./types.js";

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const MAX_ENDPOINT = 2048;
const MAX_KEY = 256;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isKey = (value: unknown): value is string =>
	typeof value === "string" && value.length <= MAX_KEY && BASE64URL.test(value);

// Push services are always https.
const isEndpoint = (value: unknown): value is string => {
	if (typeof value !== "string" || value.length > MAX_ENDPOINT) {
		return false;
	}
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
};

// undefined: not JSON at all (400).
export const readJson = async (ctx: Context): Promise<unknown> => {
	if (!(ctx.req.header("content-type") ?? "").includes("application/json")) {
		return undefined;
	}
	try {
		const value: unknown = await ctx.req.json();
		return value;
	} catch {
		return undefined;
	}
};

export const parseSubscription = (raw: unknown): PushTarget | null => {
	if (!isRecord(raw) || !isEndpoint(raw.endpoint) || !isRecord(raw.keys)) {
		return null;
	}
	const { p256dh, auth } = raw.keys;
	if (!isKey(p256dh) || !isKey(auth)) {
		return null;
	}

	return { endpoint: raw.endpoint, p256dh, auth };
};

export const parseEndpoint = (raw: unknown): string | null =>
	isRecord(raw) && isEndpoint(raw.endpoint) ? raw.endpoint : null;
