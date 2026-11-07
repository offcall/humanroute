// Gateway HTTP for e2e: cookie jar, JSON calls with an expected status, narrowing of unknown bodies.
export type Jar = Map<string, string>;

export type Body = Record<string, unknown>;

export type CallOptions = {
	jar?: Jar;
	bearer?: string;
	body?: unknown;
	status?: number;
};

export const isRecord = (value: unknown): value is Body =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const storeCookies = (jar: Jar, res: Response): void => {
	for (const line of res.headers.getSetCookie()) {
		const pair = line.split(";")[0] ?? "";
		const eq = pair.indexOf("=");
		if (eq > 0) {
			jar.set(pair.slice(0, eq), pair.slice(eq + 1));
		}
	}
};

export const cookieHeader = (jar: Jar): string =>
	[...jar].map(([name, value]) => `${name}=${value}`).join("; ");

export const request = async (
	base: string,
	method: string,
	path: string,
	options: CallOptions = {},
): Promise<Response> => {
	const headers: Record<string, string> = {};
	if (options.body !== undefined) {
		headers["content-type"] = "application/json";
	}
	if (options.bearer !== undefined) {
		headers.authorization = `Bearer ${options.bearer}`;
	}
	if (options.jar !== undefined && options.jar.size > 0) {
		headers.cookie = cookieHeader(options.jar);
	}
	const res = await fetch(`${base}${path}`, {
		method,
		headers,
		body: options.body === undefined ? null : JSON.stringify(options.body),
	});
	if (options.jar !== undefined) {
		storeCookies(options.jar, res);
	}
	return res;
};

// JSON object of a call; throws with the body when the status is not the expected one (2xx default).
export const call = async (
	base: string,
	method: string,
	path: string,
	options: CallOptions = {},
): Promise<Body> => {
	const res = await request(base, method, path, options);
	const text = await res.text();
	const okStatus =
		options.status === undefined ? res.ok : res.status === options.status;
	if (!okStatus) {
		throw new Error(`${method} ${path}: HTTP ${res.status} ${text}`);
	}
	const raw: unknown = JSON.parse(text);
	if (!isRecord(raw)) {
		throw new Error(`${method} ${path}: not a JSON object: ${text}`);
	}
	return raw;
};

export const text = (body: Body, key: string): string => {
	const value = body[key];
	if (typeof value !== "string") {
		throw new Error(`no string ${key} in ${JSON.stringify(body)}`);
	}
	return value;
};

export const record = (body: Body, key: string): Body => {
	const value = body[key];
	if (!isRecord(value)) {
		throw new Error(`no object ${key} in ${JSON.stringify(body)}`);
	}
	return value;
};

export const list = (body: Body, key: string): Body[] => {
	const value = body[key];
	if (!Array.isArray(value) || !value.every(isRecord)) {
		throw new Error(`no object array ${key} in ${JSON.stringify(body)}`);
	}
	return value;
};
