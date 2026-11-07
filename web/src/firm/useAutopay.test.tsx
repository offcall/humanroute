// After Phantom sends, the cabinet waits for the gateway's confirm (ADR 0045) instead of a timer.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { revokeTx } from "./autopayTx";
import { useAutopay } from "./useAutopay";

const WALLET = "So11111111111111111111111111111111111111112";
const AGENT = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SIGNATURE = "Sig111";

const view = (allowanceUnits: string) => ({
	wallet: WALLET,
	mint: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
	payTo: "SysvarRent111111111111111111111111111111111",
	payToAccount: "SysvarC1ock11111111111111111111111111111111",
	solLamports: 5_000_000_000,
	blockhash: "11111111111111111111111111111111",
	lastValidBlockHeight: 100,
	account: "Stake11111111111111111111111111111111111111",
	exists: true,
	balanceUnits: "13000000",
	delegate: AGENT,
	allowanceUnits,
});

const reply = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status });

const fakePhantom = () => {
	const solana = {
		isPhantom: true,
		connect: async () => ({ publicKey: WALLET }),
		signAndSendTransaction: async () => ({ signature: SIGNATURE }),
	};
	vi.stubGlobal("phantom", { solana });
};

// Every GET answers the state before the send; the confirm POST answers its own reply.
const fakeGateway = (confirmReply: Response) => {
	const posts: unknown[] = [];
	const fetcher = vi.fn(async (_path: string, init?: RequestInit) => {
		if (init?.method === "POST") {
			posts.push(JSON.parse(String(init.body)));
			return confirmReply;
		}
		return reply(200, view("0"));
	});
	vi.stubGlobal("fetch", fetcher);
	return { posts, fetcher };
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("auto-pay after Phantom sends", () => {
	test("the confirm answer becomes the shown state, without a second signing", async () => {
		fakePhantom();
		const { posts } = fakeGateway(reply(200, view("5000000")));
		const { result } = renderHook(() => useAutopay());
		await waitFor(() => expect(result.current.status).toBeDefined());

		let done = false;
		await act(async () => {
			done = await result.current.run(revokeTx);
		});
		expect(done).toBe(true);
		expect(posts).toEqual([{ signature: SIGNATURE }]);
		expect(result.current.status?.allowanceUnits).toBe(5_000_000n);
		expect(result.current.note).toBeUndefined();
		expect(result.current.lastTx).toBe(SIGNATURE);
		expect(result.current.busy).toBe(false);
	});

	test("a failed transaction shows its reason and reports failure", async () => {
		fakePhantom();
		fakeGateway(
			reply(409, { error: "tx_failed", message: "InsufficientFunds" }),
		);
		const { result } = renderHook(() => useAutopay());
		await waitFor(() => expect(result.current.status).toBeDefined());

		let done = true;
		await act(async () => {
			done = await result.current.run(revokeTx);
		});
		expect(done).toBe(false);
		expect(result.current.note).toBe(
			"The transaction failed on devnet: InsufficientFunds.",
		);
	});

	test("not confirmed in time says so; the old state stays", async () => {
		fakePhantom();
		fakeGateway(reply(504, { error: "not_confirmed" }));
		const { result } = renderHook(() => useAutopay());
		await waitFor(() => expect(result.current.status).toBeDefined());

		await act(async () => {
			await result.current.run(revokeTx);
		});
		expect(result.current.note).toMatch(/has not confirmed it yet/);
		expect(result.current.status?.allowanceUnits).toBe(0n);
	});
});
