// The chain keeps only the allowance left; the cabinet remembers the approved limit per agent key
// in this browser, to show "left of N". Missing on another browser: the meter is then hidden.
const keyOf = (delegate: string) => `humanroute.autopayLimit.${delegate}`;

export const rememberLimit = (delegate: string, units: bigint) => {
	try {
		localStorage.setItem(keyOf(delegate), units.toString());
	} catch {
		// storage blocked: the summary shows only what is left
	}
};

export const recallLimit = (delegate: string): bigint | undefined => {
	try {
		const raw = localStorage.getItem(keyOf(delegate));
		return raw !== null && /^\d+$/.test(raw) ? BigInt(raw) : undefined;
	} catch {
		return undefined;
	}
};
