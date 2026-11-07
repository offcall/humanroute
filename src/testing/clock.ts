// A clock and ids that only the test moves, so deadlines and TTLs never depend on the wall clock.
export type TestClock = {
	now: () => number;
	advance: (millis: number) => void;
};

// 2026-11-07T09:00:00Z; any fixed instant works, tests read times relative to it.
export const START = Date.UTC(2026, 10, 7, 9, 0, 0);

export const testClock = (): TestClock => {
	let current = START;

	return {
		now: () => current,
		advance: (millis) => {
			current += millis;
		},
	};
};

// UUID-shaped, so routes that check the id format accept them: ...-000000000001, ...-000000000002.
export const sequentialIds = (): (() => string) => {
	let count = 0;

	return () => {
		count += 1;
		return `00000000-0000-4000-8000-${String(count).padStart(12, "0")}`;
	};
};
