import { isRecord, num } from "./parse";

const SIGNATURE_LENGTH = 64;

const fromView = (raw: ArrayBufferView): Uint8Array | undefined => {
	const tag = Object.prototype.toString.call(raw);
	if (tag !== "[object Uint8Array]" || raw.byteLength !== SIGNATURE_LENGTH) {
		return undefined;
	}

	return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
};

const fromNumbers = (raw: unknown[]): Uint8Array | undefined => {
	if (raw.length !== SIGNATURE_LENGTH) {
		return undefined;
	}

	const out = new Uint8Array(SIGNATURE_LENGTH);
	for (let idx = 0; idx < raw.length; idx++) {
		const value = num(raw[idx]);
		if (value === undefined || !Number.isInteger(value)) {
			return undefined;
		}
		if (value < 0 || value > 255) {
			return undefined;
		}
		out[idx] = value;
	}

	return out;
};

const asBytes = (raw: unknown): Uint8Array | undefined => {
	if (ArrayBuffer.isView(raw)) {
		return fromView(raw);
	}

	return Array.isArray(raw) ? fromNumbers(raw) : undefined;
};

export const parseSignature = (raw: unknown): Uint8Array | undefined => {
	const direct = asBytes(raw);
	if (direct !== undefined) {
		return direct;
	}

	return isRecord(raw) ? asBytes(raw.signature) : undefined;
};

export const describeShape = (raw: unknown): string => {
	const tag = Object.prototype.toString.call(raw);
	if (ArrayBuffer.isView(raw)) {
		return `${typeof raw} ${tag} byteLength=${raw.byteLength}`;
	}
	if (Array.isArray(raw)) {
		return `${typeof raw} ${tag} length=${raw.length}`;
	}
	if (isRecord(raw)) {
		return `${typeof raw} ${tag} keys=${Object.keys(raw).slice(0, 5).join(",")}`;
	}

	return `${typeof raw} ${tag}`;
};

export const errorCode = (err: unknown): number | undefined =>
	isRecord(err) ? num(err.code) : undefined;

export const errorText = (err: unknown): string =>
	isRecord(err) && typeof err.message === "string" ? err.message : String(err);
