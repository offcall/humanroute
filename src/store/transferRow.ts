// Maps a transfers row to Transfer; amount TEXT -> bigint at the store boundary.
import { int, oneOf, optInt, optText, text } from "./columns.js";
import {
	type Row,
	type Transfer,
	TransferKind,
	TransferStatus,
} from "./types.js";

const KINDS: readonly TransferKind[] = Object.values(TransferKind);
const STATUSES: readonly TransferStatus[] = Object.values(TransferStatus);

const amount = (record: Row): bigint => {
	const value = text(record, "amount");
	if (!/^\d+$/.test(value)) {
		throw new Error(`transfer amount is not an integer: ${value}`);
	}
	return BigInt(value);
};

export const toTransfer = (record: Row): Transfer => ({
	id: text(record, "id"),
	jobId: text(record, "job_id"),
	kind: oneOf(record, "kind", KINDS),
	toWallet: text(record, "to_wallet"),
	amount: amount(record),
	memo: text(record, "memo"),
	status: oneOf(record, "status", STATUSES),
	txSig: optText(record, "tx_sig"),
	blockhash: optText(record, "blockhash"),
	lastValidBlockHeight: optInt(record, "last_valid_block_height"),
	attempts: int(record, "attempts"),
	lastError: optText(record, "last_error"),
	createdAt: int(record, "created_at"),
	updatedAt: int(record, "updated_at"),
});
