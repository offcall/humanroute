// Entry of the local facilitator child process (ADR 0038). Env: FACILITATOR_KEY_PATH (64-byte
// JSON key made for this run), RPC_URL, SOLANA_NETWORK, PORT.
import { readFileSync } from "node:fs";
import { serveFacilitator } from "./facilitator.js";
import { makeEd25519KeysExtractable } from "./kitShim.js";

const required = (name: string): string => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
};

const parseSecret = (raw: unknown): Uint8Array => {
	if (
		!Array.isArray(raw) ||
		raw.length !== 64 ||
		!raw.every((item) => typeof item === "number")
	) {
		throw new Error("FACILITATOR_KEY_PATH must hold a 64-byte JSON array");
	}
	return Uint8Array.from(raw);
};

const network = required("SOLANA_NETWORK");
const [namespace, reference] = network.split(":");
if (!namespace || !reference) {
	throw new Error("SOLANA_NETWORK must be a CAIP-2 id");
}

makeEd25519KeysExtractable();
const secret = parseSecret(
	JSON.parse(readFileSync(required("FACILITATOR_KEY_PATH"), "utf8")),
);
await serveFacilitator(
	secret,
	required("RPC_URL"),
	`${namespace}:${reference}`,
	Number(required("PORT")),
);
console.log(`facilitator: listening on :${required("PORT")} for ${network}`);
