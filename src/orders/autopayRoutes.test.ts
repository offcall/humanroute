// GET /api/firm/autopay (ADR 0036): what the cabinet shows to set up and turn on auto-pay.
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import {
	chainFail,
	chainOk,
	createTestGateway,
	ErrorKind,
	expectJson,
	registerFirm,
	send,
	signIn,
	type TestGateway,
	WALLETS,
} from "../testing/index.js";

const ataOf = (gateway: TestGateway, owner: string) =>
	getAssociatedTokenAddressSync(
		new PublicKey(gateway.config.usdcMint),
		new PublicKey(owner),
	).toBase58();

const readAutopay = (gateway: TestGateway, cookie?: string) =>
	send(
		gateway.app,
		"GET",
		"/api/firm/autopay",
		cookie === undefined ? {} : { cookie },
	);

describe("firm auto-pay read", () => {
	test("GET /api/firm/autopay shows balance, delegate, allowance, SOL and a fresh blockhash", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		const account = ataOf(gateway, WALLETS.firm.address);
		gateway.chain.answer.tokenAccount = async () =>
			chainOk({
				exists: true,
				address: account,
				amount: 9_007_199_254_740_993n,
				delegate: WALLETS.agent.address,
				delegatedAmount: 2_000_000n,
			});
		gateway.chain.answer.solBalance = async () => chainOk(5_000);
		gateway.chain.answer.latestBlockhash = async () =>
			chainOk({
				blockhash: "Fresh1111111111111111111111111111",
				lastValidBlockHeight: 77,
			});

		const body = await expectJson(await readAutopay(gateway, firm.cookie), 200);
		expect(body).toEqual({
			wallet: WALLETS.firm.address,
			mint: gateway.config.usdcMint,
			payTo: WALLETS.hold.address,
			payToAccount: ataOf(gateway, WALLETS.hold.address),
			solLamports: 5_000,
			blockhash: "Fresh1111111111111111111111111111",
			lastValidBlockHeight: 77,
			account,
			exists: true,
			balanceUnits: "9007199254740993",
			delegate: WALLETS.agent.address,
			allowanceUnits: "2000000",
		});
		const reads = gateway.chain.calls.map((call) => [
			call.method,
			...call.args,
		]);
		expect(reads).toEqual(
			expect.arrayContaining([
				["tokenAccount", WALLETS.firm.address],
				["solBalance", WALLETS.firm.address],
				["latestBlockhash"],
			]),
		);
	});

	test("no USDC account → exists false and the account address, no balance, delegate or allowance", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		const account = ataOf(gateway, WALLETS.firm.address);
		gateway.chain.answer.tokenAccount = async () =>
			chainOk({ exists: false, address: account });

		const body = await expectJson(await readAutopay(gateway, firm.cookie), 200);
		expect(body).toMatchObject({ account, exists: false });
		expect(body).not.toHaveProperty("balanceUnits");
		expect(body).not.toHaveProperty("delegate");
		expect(body).not.toHaveProperty("allowanceUnits");
	});

	test("401 without session, 403 for a non-firm session, 502 on a chain read failure", async () => {
		const gateway = createTestGateway();
		const stranger = await signIn(gateway.app, WALLETS.linguist);

		expect(await expectJson(await readAutopay(gateway), 401)).toEqual({
			error: "unauthorized",
		});
		const other = await readAutopay(gateway, stranger);
		expect(await expectJson(other, 403)).toEqual({ error: "forbidden" });
		expect(gateway.chain.calls).toEqual([]);

		const down = chainFail(ErrorKind.Retryable, "rpc down");
		const reads: ("tokenAccount" | "solBalance" | "latestBlockhash")[] = [
			"tokenAccount",
			"solBalance",
			"latestBlockhash",
		];
		for (const method of reads) {
			const fresh = createTestGateway();
			const owner = await registerFirm(fresh.app, WALLETS.firm);
			fresh.chain.answer[method] = async () => down;
			const res = await readAutopay(fresh, owner.cookie);
			expect(await expectJson(res, 502)).toEqual({
				error: "chain_unavailable",
			});
		}
	});
});
