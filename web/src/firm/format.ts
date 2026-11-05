import { formatUsdc } from "../shared";

const TITLE_WORDS = 4;

// Order title stand-in: the first words of the source text (plan v2).
export const taskTitle = (text: string): string => {
	const words = text.split(/\s+/).filter((word) => word.length > 0);
	const head = words.slice(0, TITLE_WORDS).join(" ");

	return words.length > TITLE_WORDS ? `${head}…` : head;
};

// "0.50" without the unit, for big numbers next to a "USDC" label
export const usdcNumber = (units: bigint): string =>
	formatUsdc(units).replace(" USDC", "");

export const plural = (count: number, word: string): string =>
	`${count} ${word}${count === 1 ? "" : "s"}`;
