export const siwsMessage = (input: {
	publicBaseUrl: string;
	wallet: string;
	nonce: string;
	issuedAt: number;
	expiresAt: number;
}): string =>
	[
		`${new URL(input.publicBaseUrl).host} wants you to sign in with your Solana account:`,
		`${input.wallet}`,
		"",
		"Sign in to HumanRoute",
		"",
		`URI: ${input.publicBaseUrl}`,
		"Version: 1",
		"Chain ID: solana:devnet",
		`Nonce: ${input.nonce}`,
		`Issued At: ${new Date(input.issuedAt).toISOString()}`,
		`Expiration Time: ${new Date(input.expiresAt).toISOString()}`,
	].join("\n");
