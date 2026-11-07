// The agent side of auto-pay (ADR 0036): web/public/agent/setup.mjs and sign.mjs run as real
// processes with a temp HOME, and the firm's SPL Approve/Revoke sent with the firm key.
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
	approveChecked,
	getAssociatedTokenAddressSync,
	revoke,
} from "@solana/spl-token";
import { type Keypair, PublicKey } from "@solana/web3.js";
import { ataOf } from "./chain.js";
import { connection, e2eEnv } from "./env.js";

const run = promisify(execFile);
const AGENT_DIR = join(import.meta.dirname, "../../web/public/agent");

export type AgentHome = {
	home: string;
	publicKey: string;
	sign: (
		message: string,
	) => Promise<{ code: number; out: string; err: string }>;
	remove: () => void;
};

export const setupAgent = async (firmWallet: string): Promise<AgentHome> => {
	const env = e2eEnv();
	const home = mkdtempSync(join(tmpdir(), "hr-agent-"));
	const childEnv = { PATH: process.env.PATH ?? "", HOME: home };
	const dest = getAssociatedTokenAddressSync(
		new PublicKey(env.mint),
		new PublicKey(env.holdAddress),
	).toBase58();
	const args = [
		join(AGENT_DIR, "setup.mjs"),
		...["--source", ataOf(firmWallet).toBase58(), "--dest", dest],
		...["--mint", env.mint, "--cabinet", `${env.gatewayUrl}/firm`],
	];
	const { stdout } = await run(process.execPath, args, { env: childEnv });
	const match = /Agent public key: (\S+)/.exec(stdout);
	if (!match?.[1]) {
		throw new Error(`setup.mjs printed no key: ${stdout}`);
	}
	const sign = async (message: string) => {
		try {
			const out = await run(
				process.execPath,
				[join(AGENT_DIR, "sign.mjs"), message],
				{ env: childEnv },
			);
			return { code: 0, out: out.stdout.trim(), err: out.stderr };
		} catch (error) {
			const err = error instanceof Error ? error.message : String(error);
			return { code: 1, out: "", err };
		}
	};
	return {
		home,
		publicKey: match[1],
		sign,
		remove: () => rmSync(home, { recursive: true, force: true }),
	};
};

export const approveAllowance = (
	firm: Keypair,
	delegate: string,
	units: bigint,
): Promise<string> =>
	approveChecked(
		connection(),
		firm,
		new PublicKey(e2eEnv().mint),
		ataOf(firm.publicKey.toBase58()),
		new PublicKey(delegate),
		firm,
		units,
		6,
	);

export const revokeAllowance = (firm: Keypair): Promise<string> =>
	revoke(connection(), firm, ataOf(firm.publicKey.toBase58()), firm);
