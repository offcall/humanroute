import { isRecord, type Parse, str } from "./parse";
import type { ApiError } from "./types";

export type ApiResult<T> =
	| { ok: true; value: T }
	| { ok: false; status: number; error: ApiError };

const failure = (
	status: number,
	error: string,
	message?: string,
): ApiResult<never> => ({
	ok: false,
	status,
	error: message === undefined ? { error } : { error, message },
});

const parseError = (raw: unknown): ApiError | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const code = str(raw.error);
	if (code === undefined) {
		return undefined;
	}
	const message = str(raw.message);

	return message === undefined ? { error: code } : { error: code, message };
};

const readBody = async (res: Response): Promise<unknown> => {
	if (res.status === 204) {
		return undefined;
	}
	const text = await res.text();
	if (text === "") {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
};

export const request = async <T>(
	method: string,
	path: string,
	body: unknown,
	parse: Parse<T>,
): Promise<ApiResult<T>> => {
	const headers: Record<string, string> = {};
	if (body !== undefined) {
		headers["content-type"] = "application/json";
	}

	try {
		const res = await fetch(path, {
			method,
			headers,
			credentials: "same-origin",
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		const raw = await readBody(res);

		if (!res.ok) {
			const error = parseError(raw);

			return error === undefined
				? failure(res.status, "http_error")
				: { ok: false, status: res.status, error };
		}
		const value = parse(raw);

		return value === undefined
			? failure(res.status, "bad_response")
			: { ok: true, value };
	} catch {
		return failure(0, "network_error");
	}
};
