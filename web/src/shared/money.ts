const DECIMALS = 6n;
const UNIT = 10n ** DECIMALS;

export const parseAmount = (raw: unknown): bigint | undefined =>
	typeof raw === "string" && /^\d+$/.test(raw) ? BigInt(raw) : undefined;

export const formatUsdc = (amount: bigint): string => {
	const whole = amount / UNIT;
	const fraction = (amount % UNIT).toString().padStart(Number(DECIMALS), "0");
	const trimmed = fraction.replace(/0+$/, "").padEnd(2, "0");

	return `${whole}.${trimmed} USDC`;
};
