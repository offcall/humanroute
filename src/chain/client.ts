// web3.js 1.x implementation of SolanaClient. Logs nothing; callers log signatures and public keys only.
import { Connection, PublicKey } from "@solana/web3.js";
import { classify } from "./errors.js";
import { preflight } from "./preflight.js";
import { preparePayout } from "./prepare-payout.js";
import { latestBlockhash, solBalance, tokenAccount } from "./reads.js";
import { blockHeight, findMemo, signatureStatus } from "./status.js";
import { Phase, type SolanaClient, type SolanaOptions } from "./types.js";

export const createSolanaClient = (opts: SolanaOptions): SolanaClient => {
	const conn = new Connection(opts.rpcUrl, opts.commitment);
	const mint = new PublicKey(opts.mint);

	return {
		holdAddress: opts.hold.publicKey.toBase58(),

		signPayout: (req) => preparePayout(conn, opts, mint, req),

		broadcast: async (bytes) => {
			try {
				const sig = await conn.sendRawTransaction(bytes, {
					preflightCommitment: opts.commitment,
				});
				return { ok: true, value: sig };
			} catch (err) {
				return { ok: false, error: classify(err, Phase.Send) };
			}
		},

		signatureStatus: (sig) => signatureStatus(conn, sig, opts.commitment),
		blockHeight: () => blockHeight(conn, opts.commitment),
		findMemo: (memo) => findMemo(conn, opts.hold.publicKey, memo),
		tokenAccount: (owner) => tokenAccount(conn, mint, owner, opts.commitment),
		solBalance: (owner) => solBalance(conn, owner, opts.commitment),
		latestBlockhash: () => latestBlockhash(conn, opts.commitment),
		preflight: () => preflight(conn, opts),
	};
};
