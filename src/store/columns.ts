// Typed column readers. A row that does not match the schema is a bug: throw.
import type { Row } from "./types.js";

const isRow = (value: unknown): value is Row =>
	typeof value === "object" && value !== null;

export const row = (value: unknown): Row | undefined => {
	if (value === undefined) {
		return undefined;
	}
	if (!isRow(value)) {
		throw new Error("unexpected SQLite row");
	}
	return value;
};

export const rows = (values: unknown[]): Row[] =>
	values.map((value) => {
		const found = row(value);
		if (!found) {
			throw new Error("unexpected SQLite row");
		}
		return found;
	});

export const text = (record: Row, key: string): string => {
	const value = record[key];
	if (typeof value !== "string") {
		throw new Error(`column ${key} is not text`);
	}
	return value;
};

export const optText = (record: Row, key: string): string | null =>
	record[key] === null ? null : text(record, key);

export const int = (record: Row, key: string): number => {
	const value = record[key];
	if (typeof value === "number" && Number.isInteger(value)) {
		return value;
	}
	if (typeof value === "bigint") {
		return Number(value);
	}
	throw new Error(`column ${key} is not an integer`);
};

export const optInt = (record: Row, key: string): number | null =>
	record[key] === null ? null : int(record, key);

// Bigint amount stored as a decimal TEXT (ADR money rules).
export const units = (record: Row, key: string): bigint => {
	const value = text(record, key);
	if (!/^\d+$/.test(value)) {
		throw new Error(`column ${key} is not an integer amount: ${value}`);
	}
	return BigInt(value);
};

export const oneOf = <T = unknown>(
	record: Row,
	key: string,
	allowed: readonly T[],
): T => {
	const value = text(record, key);
	const hit = allowed.find((candidate) => candidate === value);
	if (hit === undefined) {
		throw new Error(`column ${key} has unexpected value ${value}`);
	}
	return hit;
};
