// SPL ApproveChecked and Revoke on the firm's USDC account (ADR 0036). The firm signs and sends
// them with Phantom; the gateway sends nothing.
import {
	AccountRole,
	address,
	appendTransactionMessageInstruction,
	blockhash,
	compileTransaction,
	createTransactionMessage,
	getTransactionEncoder,
	type Instruction,
	pipe,
	setTransactionMessageFeePayer,
	setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";
import type { Autopay } from "./autopayParse";

const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const APPROVE_CHECKED = 13;
const REVOKE = 5;
const USDC_DECIMALS = 6;

const u64 = (value: bigint): Uint8Array => {
	const bytes = new Uint8Array(8);
	new DataView(bytes.buffer).setBigUint64(0, value, true);
	return bytes;
};

const toTransaction = (
	status: Autopay,
	instruction: Instruction,
): VersionedTransaction => {
	const lifetime = {
		blockhash: blockhash(status.blockhash),
		lastValidBlockHeight: BigInt(status.lastValidBlockHeight),
	};
	const message = pipe(
		createTransactionMessage({ version: 0 }),
		(draft) => setTransactionMessageFeePayer(address(status.wallet), draft),
		(draft) => setTransactionMessageLifetimeUsingBlockhash(lifetime, draft),
		(draft) => appendTransactionMessageInstruction(instruction, draft),
	);
	const bytes = getTransactionEncoder().encode(compileTransaction(message));
	return VersionedTransaction.deserialize(Uint8Array.from(bytes));
};

// "Agent key `delegate` may spend up to `limitUnits` from my USDC account."
export const approveTx = (
	status: Autopay,
	delegate: string,
	limitUnits: bigint,
) =>
	toTransaction(status, {
		programAddress: TOKEN_PROGRAM,
		accounts: [
			{ address: address(status.account), role: AccountRole.WRITABLE },
			{ address: address(status.mint), role: AccountRole.READONLY },
			{ address: address(delegate), role: AccountRole.READONLY },
			{ address: address(status.wallet), role: AccountRole.READONLY_SIGNER },
		],
		data: Uint8Array.from([APPROVE_CHECKED, ...u64(limitUnits), USDC_DECIMALS]),
	});

export const revokeTx = (status: Autopay) =>
	toTransaction(status, {
		programAddress: TOKEN_PROGRAM,
		accounts: [
			{ address: address(status.account), role: AccountRole.WRITABLE },
			{ address: address(status.wallet), role: AccountRole.READONLY_SIGNER },
		],
		data: Uint8Array.from([REVOKE]),
	});

// ApproveChecked carries a u64; larger values would wrap.
const MAX_U64 = 2n ** 64n - 1n;

// "2.5" -> 2_500_000n; undefined unless a positive amount with at most 6 decimals that fits a u64.
export const parseUsdcInput = (raw: string): bigint | undefined => {
	const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(raw.trim());
	if (match === null) {
		return undefined;
	}
	const units =
		BigInt(match[1] ?? "0") * 1_000_000n +
		BigInt((match[2] ?? "").padEnd(6, "0"));
	return units > 0n && units <= MAX_U64 ? units : undefined;
};
