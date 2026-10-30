import { randomBytes } from "node:crypto";
import { withTransaction } from "../store/index.js";
import { siwsMessage } from "./message.js";
import { NONCES_SQL } from "./sql.js";
import type { AuthDeps } from "./types.js";

export const createNonce = (
	deps: AuthDeps,
	wallet: string,
): { nonce: string; message: string } => {
	// SIWS allows only letters and digits in the nonce; wallets reject "-" and "_".
	const nonce = randomBytes(32).toString("hex");
	const issuedAt = deps.now();
	const expiresAt = issuedAt + deps.nonceTtlSeconds * 1000;
	const message = siwsMessage({
		publicBaseUrl: deps.publicBaseUrl,
		wallet,
		nonce,
		issuedAt,
		expiresAt,
	});

	deps.database
		.prepare(NONCES_SQL.insert)
		.run(nonce, wallet, message, expiresAt);

	return { nonce, message };
};

// Marks the nonce used before any signature check, so a nonce never verifies twice.
export const consumeNonce = (
	deps: AuthDeps,
	wallet: string,
	nonce: string,
): string | null => {
	const now = deps.now();

	return withTransaction(deps.database, () => {
		const result = deps.database
			.prepare(NONCES_SQL.consume)
			.run(now, nonce, wallet, now);

		if (result.changes !== 1) {
			return null;
		}

		const message: unknown = deps.database
			.prepare(NONCES_SQL.message)
			.pluck()
			.get(nonce);

		return typeof message === "string" ? message : null;
	});
};
