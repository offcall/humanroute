// Maps a v2 transfers row to PayoutTransfer; legs JSON is validated when read back (ADR 0024).
import { TransferStatus } from "../store/index.js";
import { int, oneOf, optInt, optText, type Row, text } from "../tasks/index.js";
import {
	type Leg,
	LegRole,
	PayoutKind,
	type PayoutTransfer,
} from "./taskTypes.js";

const KINDS: readonly PayoutKind[] = Object.values(PayoutKind);
const ROLES: readonly LegRole[] = Object.values(LegRole);
const STATUSES: readonly TransferStatus[] = Object.values(TransferStatus);

const toLeg = (raw: unknown): Leg => {
	if (typeof raw !== "object" || raw === null) {
		throw new Error("transfer leg is not an object");
	}
	const record: Row = Object.fromEntries(Object.entries(raw));
	const units = text(record, "units");
	if (!/^\d+$/.test(units)) {
		throw new Error(`transfer leg units is not an integer: ${units}`);
	}
	return {
		role: oneOf(record, "role", ROLES),
		wallet: text(record, "wallet"),
		units: BigInt(units),
	};
};

export const parseLegs = (json: string): Leg[] => {
	const raw: unknown = JSON.parse(json);
	if (!Array.isArray(raw)) {
		throw new Error("transfer legs is not an array");
	}
	return raw.map(toLeg);
};

export const legsJson = (legs: Leg[]): string =>
	JSON.stringify(legs.map((leg) => ({ ...leg, units: leg.units.toString() })));

export const toPayoutTransfer = (record: Row): PayoutTransfer => ({
	id: text(record, "id"),
	taskId: text(record, "task_id"),
	kind: oneOf(record, "kind", KINDS),
	legs: parseLegs(text(record, "legs")),
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
