// Requests against the in-process Hono app (no server, no port) and JSON reads without casts.
import type { Hono } from "hono";

export type Json = Record<string, unknown>;

export type SendOptions = {
	body?: unknown;
	cookie?: string;
	bearer?: string;
	headers?: Record<string, string>;
};

export const send = (
	app: Hono,
	method: string,
	path: string,
	options?: SendOptions,
): Promise<Response> => {
	const headers = new Headers(options?.headers);
	const init: RequestInit = { method, headers };
	if (options?.body !== undefined) {
		headers.set("content-type", "application/json");
		init.body = JSON.stringify(options.body);
	}
	if (options?.cookie !== undefined) {
		headers.set("cookie", options.cookie);
	}
	if (options?.bearer !== undefined) {
		headers.set("authorization", `Bearer ${options.bearer}`);
	}

	return Promise.resolve(app.request(path, init));
};

const isJson = (value: unknown): value is Json =>
	typeof value === "object" && value !== null && !Array.isArray(value);

// The JSON object of a response with the expected status; anything else throws with the body.
export const expectJson = async (
	res: Response,
	status: number,
): Promise<Json> => {
	const text = await res.text();
	if (res.status !== status) {
		throw new Error(`expected HTTP ${status}, got ${res.status}: ${text}`);
	}
	const body: unknown = JSON.parse(text);
	if (!isJson(body)) {
		throw new Error(`expected a JSON object, got ${text}`);
	}

	return body;
};

export const textField = (body: Json, key: string): string => {
	const value = body[key];
	if (typeof value !== "string") {
		throw new Error(`${key} is not a string in ${JSON.stringify(body)}`);
	}

	return value;
};

export const objectField = (body: Json, key: string): Json => {
	const value = body[key];
	if (!isJson(value)) {
		throw new Error(`${key} is not an object in ${JSON.stringify(body)}`);
	}

	return value;
};

export const listField = (body: Json, key: string): Json[] => {
	const value = body[key];
	if (!Array.isArray(value) || !value.every(isJson)) {
		throw new Error(
			`${key} is not a list of objects in ${JSON.stringify(body)}`,
		);
	}

	return value;
};
