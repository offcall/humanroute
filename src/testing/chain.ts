// Scriptable SolanaClient without network. The defaults answer like a healthy devnet; a test
// replaces any answer through `answer` and reads `calls` to see what was signed, sent or read.
import type {
	ChainResult,
	ErrorKind,
	PayoutRequest,
	SolanaClient,
} from "../chain/index.js";

type Method = Exclude<keyof SolanaClient, "holdAddress">;
type Answers = Omit<SolanaClient, "holdAddress">;

export type ChainCall = { method: Method; args: unknown[] };

export type FakeChain = SolanaClient & { answer: Answers; calls: ChainCall[] };

// 32 zero bytes in base58: a well-formed blockhash that no real cluster returns.
export const FAKE_BLOCKHASH = "11111111111111111111111111111111";

export const chainOk = <T = unknown>(value: T): ChainResult<T> => ({
	ok: true,
	value,
});

export const chainFail = (
	kind: ErrorKind,
	message: string,
): ChainResult<never> => ({ ok: false, error: { kind, message } });

export const fakeChain = (holdAddress: string): FakeChain => {
	const calls: ChainCall[] = [];
	let signed = 0;
	const answer: Answers = {
		signPayout: async () => {
			signed += 1;
			return chainOk({
				signature: `payout-sig-${signed}`,
				blockhash: FAKE_BLOCKHASH,
				lastValidBlockHeight: 1000,
				bytes: Uint8Array.of(signed),
			});
		},
		broadcast: async () => chainOk(`payout-sig-${signed}`),
		signatureStatus: async () => chainOk({ state: "confirmed" }),
		blockHeight: async () => chainOk(1),
		findMemo: async () => chainOk({ state: "absent" }),
		tokenAccount: async (owner) =>
			chainOk({ exists: false, address: `no-usdc-account-of-${owner}` }),
		solBalance: async () => chainOk(1_000_000_000),
		latestBlockhash: async () =>
			chainOk({ blockhash: FAKE_BLOCKHASH, lastValidBlockHeight: 1000 }),
		preflight: async () => [],
	};
	const record = (method: Method, ...args: unknown[]) => {
		calls.push({ method, args });
	};

	return {
		holdAddress,
		answer,
		calls,
		signPayout: (req: PayoutRequest) => {
			record("signPayout", req);
			return answer.signPayout(req);
		},
		broadcast: (bytes) => {
			record("broadcast", bytes);
			return answer.broadcast(bytes);
		},
		signatureStatus: (signature) => {
			record("signatureStatus", signature);
			return answer.signatureStatus(signature);
		},
		blockHeight: () => {
			record("blockHeight");
			return answer.blockHeight();
		},
		findMemo: (memo, since) => {
			record("findMemo", memo, since);
			return answer.findMemo(memo, since);
		},
		tokenAccount: (owner) => {
			record("tokenAccount", owner);
			return answer.tokenAccount(owner);
		},
		solBalance: (owner) => {
			record("solBalance", owner);
			return answer.solBalance(owner);
		},
		latestBlockhash: () => {
			record("latestBlockhash");
			return answer.latestBlockhash();
		},
		preflight: () => {
			record("preflight");
			return answer.preflight();
		},
	};
};
