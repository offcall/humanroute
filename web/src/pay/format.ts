const UNITS_PER_USDC = 1_000_000n;

export const formatUsdc = (units: bigint): string => {
	const whole = units / UNITS_PER_USDC;
	const fraction = (units % UNITS_PER_USDC).toString().padStart(6, "0");
	const trimmed = fraction.replace(/0+$/, "").padEnd(2, "0");

	return `${whole}.${trimmed}`;
};
