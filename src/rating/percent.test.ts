// Rating percentages (ADR 0025): integer percent rounded down, null with nothing to count.
import { describe, expect, it } from "vitest";
import { ratingPct, rejectPct } from "./percent.js";

describe("RT-01T rating percentages", () => {
	it.each([
		[0, 0, 0, null],
		[1, 0, 0, 100],
		[0, 1, 0, 0],
		[0, 0, 1, 0],
		[2, 1, 0, 66],
		[1, 1, 1, 33],
		[199, 0, 1, 99],
	])(
		"RT-01 ratingPct(%i approved, %i rejected, %i late) = %s",
		(approved, rejected, late, pct) => {
			expect(ratingPct(approved, rejected, late)).toBe(pct);
		},
	);

	it.each([
		[0, 0, null],
		[1, 0, 0],
		[0, 1, 100],
		[1, 2, 66],
		[2, 1, 33],
		[1, 199, 99],
	])(
		"RT-02 rejectPct(%i approved, %i rejected) = %s",
		(approved, rejected, pct) => {
			expect(rejectPct(approved, rejected)).toBe(pct);
		},
	);
});
