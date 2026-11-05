import { type BoardTask, formatUsdc, pairLabel } from "../shared";

// "10.24 USDC" → "10.24": the unit sits in a label next to the number.
export const amountOnly = (units: bigint): string =>
	formatUsdc(units).replace(" USDC", "");

const plural = (count: number, word: string): string =>
	count === 1 ? `1 ${word}` : `${count} ${word}s`;

// "1 minute 25 seconds"
export const spokenLeft = (leftMs: number): string => {
	const total = leftMs > 0 ? Math.ceil(leftMs / 1000) : 0;
	const minutes = Math.floor(total / 60);
	const seconds = plural(total % 60, "second");

	return minutes === 0 ? seconds : `${plural(minutes, "minute")} ${seconds}`;
};

// "English to Spanish, Kito Pay via Nairobi Lingua, 0.35 USDC"
export const jobLabel = (task: BoardTask, agencyName: string): string =>
	[
		pairLabel(task.sourceLang, task.targetLang),
		`${task.firmName} via ${agencyName}`,
		formatUsdc(task.priceUnits),
	].join(", ");
