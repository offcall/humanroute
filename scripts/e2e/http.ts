// Gateway HTTP helpers for the e2e flow: cookie jar, JSON calls, narrowing of unknown bodies.
export type Jar = Map<string, string>;

export type Body = Record<string, unknown>;

type Options = { jar?: Jar; bearer?: string; body?: unknown };

const storeCookies = (jar: Jar, res: Response): void => {
	for (const line of res.headers.getSetCookie()) {
		const pair = line.split(";")[0] ?? "";
		const eq = pair.indexOf("=");
		if (eq > 0) {
			jar.set(pair.slice(0, eq), pair.slice(eq + 1));
		}
	}
};

const cookieHeader = (jar: Jar): string =>
	[...jar].map(([name, value]) => `${name}=${value}`).join("; ");

export const isRecord = (value: unknown): value is Body =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const readBody = async (res: Response, step: string): Promise<Body> => {
	const raw: unknown = await res.json().catch(() => undefined);
	if (!res.ok) {
		throw new Error(`${step} failed: ${res.status} ${JSON.stringify(raw)}`);
	}
	if (!isRecord(raw)) {
		throw new Error(`${step} returned no JSON object`);
	}
	return Object.fromEntries(Object.entries(raw));
};

export const call = async (
	gateway: string,
	method: string,
	path: string,
	step: string,
	options: Options = {},
): Promise<Body> => {
	const headers: Record<string, string> = {};
	if (method !== "GET") {
		headers["content-type"] = "application/json";
	}
	if (options.bearer !== undefined) {
		headers.authorization = `Bearer ${options.bearer}`;
	}
	if (options.jar !== undefined && options.jar.size > 0) {
		headers.cookie = cookieHeader(options.jar);
	}
	const res = await fetch(`${gateway}${path}`, {
		method,
		headers,
		body: options.body === undefined ? null : JSON.stringify(options.body),
	});
	if (options.jar !== undefined) {
		storeCookies(options.jar, res);
	}
	return readBody(res, step);
};

export const stringField = (body: Body, key: string): string => {
	const value = body[key];
	if (typeof value !== "string") {
		throw new Error(`response has no string ${key}`);
	}
	return value;
};

export const recordField = (body: Body, key: string): Body => {
	const value = body[key];
	if (!isRecord(value)) {
		throw new Error(`response has no object ${key}`);
	}
	return value;
};

export const arrayField = (body: Body, key: string): Body[] => {
	const value = body[key];
	if (!Array.isArray(value) || !value.every(isRecord)) {
		throw new Error(`response has no object array ${key}`);
	}
	return value.map((item) => Object.fromEntries(Object.entries(item)));
};

export const numberField = (body: Body, key: string): number => {
	const value = body[key];
	if (typeof value !== "number") {
		throw new Error(`response has no number ${key}`);
	}
	return value;
};
