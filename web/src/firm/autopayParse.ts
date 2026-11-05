// GET /api/firm/autopay: the firm's USDC account, its delegate and allowance (ADR 0036).
import { isRecord, num, parseAmount, str } from "../shared";

export type Autopay = {
	wallet: string;
	mint: string;
	payTo: string;
	blockhash: string;
	lastValidBlockHeight: number;
	account: string;
	exists: boolean;
	balanceUnits: bigint | undefined;
	delegate: string | null;
	allowanceUnits: bigint;
};

export const parseAutopay = (raw: unknown): Autopay | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const wallet = str(raw.wallet);
	const mint = str(raw.mint);
	const payTo = str(raw.payTo);
	const recent = str(raw.blockhash);
	const height = num(raw.lastValidBlockHeight);
	const account = str(raw.account);
	if (
		!wallet ||
		!mint ||
		!payTo ||
		!recent ||
		height === undefined ||
		!account
	) {
		return undefined;
	}
	const delegate = str(raw.delegate);
	return {
		wallet,
		mint,
		payTo,
		blockhash: recent,
		lastValidBlockHeight: height,
		account,
		exists: raw.exists === true,
		balanceUnits: parseAmount(raw.balanceUnits),
		delegate: delegate === undefined ? null : delegate,
		allowanceUnits: parseAmount(raw.allowanceUnits) ?? 0n,
	};
};
