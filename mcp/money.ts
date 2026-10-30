const USDC_DECIMALS = 6;
const MIN_FRACTION_DIGITS = 2;
const UNITS_PER_USDC = 10n ** BigInt(USDC_DECIMALS);

// Units are validated as digit strings at the gateway boundary (parse.ts).
export const formatUsdc = (units: string): string => {
	const value = BigInt(units);
	const whole = value / UNITS_PER_USDC;
	const fraction = (value % UNITS_PER_USDC)
		.toString()
		.padStart(USDC_DECIMALS, "0")
		.replace(/0+$/, "")
		.padEnd(MIN_FRACTION_DIGITS, "0");

	return `${whole}.${fraction} USDC`;
};
