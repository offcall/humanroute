// Typed readers for accounts rows. A row that does not match the schema is a bug: throw.
import type { Agency, Firm, LangPair, LinguistLink } from "./types.js";

type Row = Record<string, unknown>;

const asRow = (value: unknown): Row | null => {
	if (value === undefined) {
		return null;
	}

	if (typeof value !== "object" || value === null) {
		throw new Error("unexpected SQLite row");
	}

	return Object.fromEntries(Object.entries(value));
};

const text = (record: Row, key: string): string => {
	const value = record[key];

	if (typeof value !== "string") {
		throw new Error(`column ${key} is not text`);
	}

	return value;
};

export const toFirm = (value: unknown): Firm | null => {
	const record = asRow(value);

	if (record === null) {
		return null;
	}

	return {
		id: text(record, "id"),
		name: text(record, "name"),
		wallet: text(record, "wallet"),
	};
};

export const toAgency = (value: unknown): Agency | null => {
	const record = asRow(value);

	if (record === null) {
		return null;
	}

	return {
		id: text(record, "id"),
		name: text(record, "name"),
		wallet: text(record, "wallet"),
	};
};

export const toLink = (value: unknown): LinguistLink | null => {
	const record = asRow(value);

	if (record === null) {
		return null;
	}

	return {
		linguistId: text(record, "linguist_id"),
		linguistWallet: text(record, "linguist_wallet"),
		agencyId: text(record, "agency_id"),
		agencyWallet: text(record, "agency_wallet"),
	};
};

export const toPairs = (values: unknown[]): LangPair[] =>
	values.map((value) => {
		const record = asRow(value);

		if (record === null) {
			throw new Error("unexpected SQLite row");
		}

		return {
			source: text(record, "source_lang"),
			target: text(record, "target_lang"),
		};
	});
