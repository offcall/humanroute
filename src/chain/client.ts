// web3.js 1.x implementation of SolanaClient. Logs nothing; callers log signatures and public keys only.
import { Connection, PublicKey } from "@solana/web3.js";
import { USDC_DECIMALS } from "../config/index.js";
import { classify } from "./errors.js";
import { preflight } from "./preflight.js";
import { preparePayout } from "./prepare-payout.js";
import { blockHeight, findMemo, signatureStatus } from "./status.js";
import { recipientAta, signTransfer } from "./transfer.js";
import {
	ErrorKind,
	Phase,
	type SolanaClient,
	type SolanaOptions,
} from "./types.js";

export const createSolanaClient = (opts: SolanaOptions): SolanaClient => {
	const conn = new Connection(opts.rpcUrl, opts.commitment);
	const mint = new PublicKey(opts.mint);

	return {
		holdAddress: opts.hold.publicKey.toBase58(),

		signTransfer: async (req) => {
			try {
				const toAta = recipientAta(mint, req.toWallet);
				if (!(await conn.getAccountInfo(toAta, opts.commitment))) {
					const message = `recipient ${req.toWallet} has no token account ${toAta.toBase58()}`;
					return { ok: false, error: { kind: ErrorKind.Final, message } };
				}
				const { blockhash, lastValidBlockHeight } =
					await conn.getLatestBlockhash(opts.commitment);
				const params = {
					hold: opts.hold,
					mint,
					decimals: USDC_DECIMALS,
					blockhash,
					lastValidBlockHeight,
				};
				return { ok: true, value: signTransfer(params, req) };
			} catch (err) {
				return { ok: false, error: classify(err, Phase.Prepare) };
			}
		},

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
		preflight: () => preflight(conn, opts),
	};
};
