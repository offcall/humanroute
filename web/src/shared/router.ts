import { useSyncExternalStore } from "react";

export type Params = Record<string, string>;

const subscribe = (notify: () => void): (() => void) => {
	window.addEventListener("popstate", notify);

	return () => window.removeEventListener("popstate", notify);
};

const snapshot = (): string => window.location.pathname;

export const useRoute = (): string => useSyncExternalStore(subscribe, snapshot);

export const navigate = (to: string): void => {
	window.history.pushState(null, "", to);
	window.dispatchEvent(new PopStateEvent("popstate"));
};

const decodeSegment = (segment: string): string | undefined => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
};

export const matchPath = (
	pattern: string,
	path: string,
): Params | undefined => {
	const want = pattern.split("/").filter((part) => part !== "");
	const have = path.split("/").filter((part) => part !== "");
	if (want.length !== have.length) {
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
