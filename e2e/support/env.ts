// The environment of the running e2e project and its funded firm wallets.
import { Connection, Keypair } from "@solana/web3.js";
import { inject } from "vitest";
import { installEgressGuard } from "../env/egress.js";
import type { E2eEnv } from "../env/types.js";

// Localnet workers inherit E2E_EGRESS_LOG from the setup and refuse non-loopback hosts too.
if (process.env.E2E_EGRESS_LOG) {
	installEgressGuard();
}

export const e2eEnv = (): E2eEnv => inject("e2e");

// The gateway the support helpers talk to: the environment's, or one a case started itself.
let gatewayOverride: string | null = null;

export const gatewayUrl = (): string => gatewayOverride ?? e2eEnv().gatewayUrl;

export const useGateway = (url: string | null): void => {
	gatewayOverride = url;
};

export const connection = (): Connection =>
	new Connection(e2eEnv().rpcUrl, "confirmed");

// Each suite takes its own funded firm, so ratings and balances never mix between files.
export const firmKey = (index: number): Keypair => {
	const secret = e2eEnv().firms[index];
	if (secret === undefined) {
		throw new Error(`no funded firm wallet ${index} in this environment`);
	}
	return Keypair.fromSecretKey(Uint8Array.from(secret));
};

// Bounded polling: returns the first value `read` accepts, or throws after timeoutMs.
export const pollUntil = async <T = unknown>(
	read: () => Promise<T>,
	accept: (value: T) => boolean,
	timeoutMs: number,
	what: string,
): Promise<T> => {
	const deadline = Date.now() + timeoutMs;
	let last: T | undefined;
	while (Date.now() < deadline) {
		last = await read();
		if (accept(last)) {
			return last;
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error(
		`${what}: not reached in ${timeoutMs} ms, last ${String(JSON.stringify(last))}`,
	);
};
