import { useSyncExternalStore } from "react";

export type Params = Record<string, string>;

const subscribe = (notify: () => void): (() => void) => {
	window.addEventListener("popstate", notify);

	return () => window.removeEventListener("popstate", notify);
};

const snapshot = (): string => window.location.pathname;

export const useRoute = (): string => useSyncExternalStore(subscribe, snapshot);

export const navigate = (to: string, replace = false): void => {
	if (replace) {
		window.history.replaceState(null, "", to);
	} else {
		window.history.pushState(null, "", to);
	}
	window.dispatchEvent(new PopStateEvent("popstate"));
};

const decodeSegment = (segment: string): string | undefined => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
};

// A trailing "/*" in the pattern matches the path itself and any deeper path.
export const matchPath = (
	pattern: string,
	path: string,
): Params | undefined => {
	const parts = pattern.split("/").filter((part) => part !== "");
	const isPrefix = parts.at(-1) === "*";
	const want = isPrefix ? parts.slice(0, -1) : parts;
	const have = path.split("/").filter((part) => part !== "");
	const sizeOk = isPrefix
		? have.length >= want.length
		: have.length === want.length;
	if (!sizeOk) {
		return undefined;
	}

	const params: Params = {};
	for (const [index, part] of want.entries()) {
		const actual = have[index];
		if (actual === undefined) {
			return undefined;
		}
		if (part.startsWith(":")) {
			const value = decodeSegment(actual);
			if (value === undefined) {
				return undefined;
			}
			params[part.slice(1)] = value;
		} else if (part !== actual) {
			return undefined;
		}
	}

	return params;
};
