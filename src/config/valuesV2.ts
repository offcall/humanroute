// Parsers for the v2 env values. Each returns the value or an error string.
import { type Parsed, TimerMode } from "./types.js";
import { parseInteger } from "./values.js";

export const WINDOW_PRESETS: Record<
	TimerMode,
	{ claim: number; work: number }
> = {
	[TimerMode.Video]: { claim: 60, work: 180 },
	[TimerMode.Public]: { claim: 1800, work: 3600 },
};

export const parseTimerMode = (
	name: string,
	raw: string,
): Parsed<TimerMode> => {
	const found = Object.values(TimerMode).find((mode) => mode === raw);
	if (found !== undefined) {
		return { ok: true, value: found };
	}
	return { ok: false, error: `${name} must be video or public, got "${raw}"` };
};

export const parseBps = (name: string, raw: string): Parsed<bigint> => {
	const parsed = parseInteger(name, raw, 0, 10_000);
	return parsed.ok ? { ok: true, value: BigInt(parsed.value) } : parsed;
};

// Empty means the timer preset.
export const parseWindow = (
	name: string,
	raw: string,
	preset: number,
): Parsed<number> =>
	raw === ""
		? { ok: true, value: preset }
		: parseInteger(name, raw, 1, 604_800);

export const parseRequired = <T = unknown>(
	name: string,
	raw: string,
	parser: (name: string, raw: string) => Parsed<T>,
): Parsed<T> =>
	raw === "" ? { ok: false, error: `${name} is required` } : parser(name, raw);

export const parseNonEmpty = (name: string, raw: string): Parsed<string> =>
	raw === ""
		? { ok: false, error: `${name} must not be empty` }
		: { ok: true, value: raw };
