export type Parse<T> = (raw: unknown) => T | undefined;

export const isRecord = (raw: unknown): raw is Record<string, unknown> =>
	typeof raw === "object" && raw !== null && !Array.isArray(raw);

export const str = (raw: unknown): string | undefined =>
	typeof raw === "string" ? raw : undefined;

export const num = (raw: unknown): number | undefined =>
	typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;

export const arr = <T>(raw: unknown, item: Parse<T>): T[] | undefined => {
	if (!Array.isArray(raw)) {
		return undefined;
	}

	const out: T[] = [];
	for (const entry of raw) {
		const value = item(entry);
		if (value === undefined) {
			return undefined;
		}
		out.push(value);
	}

	return out;
};

// null and a missing value both give null; an invalid value gives undefined
export const orNull = <T>(
	raw: unknown,
	item: Parse<T>,
): T | null | undefined => {
	if (raw === null || raw === undefined) {
		return null;
	}

	return item(raw);
};
