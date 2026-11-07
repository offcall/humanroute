// POST /api/orders/draft/:draftId/unsigned refusals (ADR 0036, failure table rows 2, 4, 10-12):
// Bearer, existence, ownership, paid, body, allowance, chain; nothing is signed or sent.
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
	chainFail,
	chainOk,
	createDraft,
	createTestGateway,
	ErrorKind,
	expectJson,
	payDraft,
	paymentFor,
	registerFirm,
	send,
	type TestGateway,
	textField,
	WALLETS,
} from "../testing/index.js";

const TOTAL = 1_000_000n;
const FEE_PAYER = WALLETS.facilitator.address;
const UNKNOWN_DRAFT = "00000000-0000-4000-8000-999999999999";

type Held = {
	amount: bigint;
	delegatedAmount: bigint;
	delegate: string | null;
};

const READY: Held = {
	amount: TOTAL,
	delegatedAmount: TOTAL,
	delegate: WALLETS.agent.address,
};

const ataOf = (gateway: TestGateway, owner: string) =>
	getAssociatedTokenAddressSync(
		new PublicKey(gateway.config.usdcMint),
		new PublicKey(owner),
	).toBase58();

const holding = (gateway: TestGateway, held: Held | null) => {
	gateway.chain.answer.tokenAccount = async (owner) => {
		const address = ataOf(gateway, owner);
		return chainOk(
			held === null
				? { exists: false, address }
				: { exists: true, address, ...held },
		);
	};
};

const setup = async (held: Held | null = READY) => {
	const gateway = createTestGateway();
	holding(gateway, held);
	const firm = await registerFirm(gateway.app, WALLETS.firm);
	const draftId = textField(
		await createDraft(gateway.app, firm.mcpToken),
		"draftId",
	);
	gateway.chain.calls.length = 0;
	return { gateway, firm, draftId };
};

const unsigned = (
	gateway: TestGateway,
	draftId: string,
	bearer: string | undefined,
	body: unknown = { feePayer: FEE_PAYER },
) =>
	send(gateway.app, "POST", `/api/orders/draft/${draftId}/unsigned`, {
		...(bearer === undefined ? {} : { bearer }),
		body,
	});

const chainMethods = (gateway: TestGateway) =>
	gateway.chain.calls.map((call) => call.method);

describe("AP-21T unsigned payment route refusals", () => {
	it("AP-21 no token 401, unknown draft 404, expired unpaid draft 404, another firm's draft 403, in that order", async () => {
		const { gateway, firm, draftId } = await setup();
		const other = await registerFirm(gateway.app, WALLETS.agency);

		const anonymous = await unsigned(gateway, UNKNOWN_DRAFT, undefined);
		expect(await expectJson(anonymous, 401)).toEqual({ error: "unauthorized" });
		const badToken = await unsigned(gateway, draftId, "not-a-token");
		expect(await expectJson(badToken, 401)).toEqual({ error: "unauthorized" });
		const unknown = await unsigned(gateway, UNKNOWN_DRAFT, other.mcpToken);
		expect(await expectJson(unknown, 404)).toEqual({ error: "not_found" });
		const foreign = await unsigned(gateway, draftId, other.mcpToken);
		expect(await expectJson(foreign, 403)).toEqual({ error: "forbidden" });

		gateway.clock.advance(gateway.config.draftTtlSeconds * 1000);
		const expired = await unsigned(gateway, draftId, firm.mcpToken);
		expect(await expectJson(expired, 404)).toEqual({ error: "not_found" });
		expect(chainMethods(gateway)).toEqual([]);
	});

	it("AP-22 paid draft → 409 draft_paid with orderId", async () => {
		const { gateway, firm, draftId } = await setup();
		const header = await paymentFor(gateway.app, draftId, WALLETS.firm, "a");
		const paid = await expectJson(
			await payDraft(gateway.app, draftId, header),
			201,
		);
		gateway.chain.calls.length = 0;

		const res = await unsigned(gateway, draftId, firm.mcpToken);
		expect(await expectJson(res, 409)).toEqual({
			error: "draft_paid",
			orderId: paid.orderId,
		});
		expect(chainMethods(gateway)).toEqual([]);
	});

	const refusals: [string, Held | null, (gateway: TestGateway) => unknown][] = [
		[
			"no_usdc_account",
			null,
			(gateway) => ({
				error: "no_usdc_account",
				account: ataOf(gateway, WALLETS.firm.address),
			}),
		],
		[
			"autopay_off",
			{ ...READY, delegate: null },
			() => ({ error: "autopay_off" }),
		],
		[
			"autopay_limit",
			{ ...READY, delegatedAmount: TOTAL - 1n },
			() => ({ error: "autopay_limit", leftUnits: "999999" }),
		],
		[
			"insufficient_usdc",
			{ ...READY, amount: TOTAL - 1n },
			() => ({ error: "insufficient_usdc", balanceUnits: "999999" }),
		],
	];

	it.each(refusals)(
		"AP-23 409 %s with zero blockhash, sign or broadcast",
		async (_name, held, expected) => {
			const { gateway, firm, draftId } = await setup(held);
			const res = await unsigned(gateway, draftId, firm.mcpToken);
			expect(await expectJson(res, 409)).toEqual(expected(gateway));
			expect(chainMethods(gateway)).toEqual(["tokenAccount"]);
		},
	);

	const badBodies: [string, unknown][] = [
		["missing fee payer", {}],
		["invalid fee payer", { feePayer: "not-a-key" }],
		["fee payer not a string", { feePayer: 42 }],
	];

	it.each(badBodies)("AP-24 %s → 422", async (_name, body) => {
		const { gateway, firm, draftId } = await setup();
		const res = await unsigned(gateway, draftId, firm.mcpToken, body);
		expect(await expectJson(res, 422)).toEqual({ error: "invalid_body" });
		expect(chainMethods(gateway)).toEqual([]);
	});

	it("AP-24 malformed JSON → 422", async () => {
		const { gateway, firm, draftId } = await setup();
		const res = await gateway.app.request(
			`/api/orders/draft/${draftId}/unsigned`,
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${firm.mcpToken}`,
					"content-type": "application/json",
				},
				body: "{",
			},
		);
		expect(await expectJson(res, 422)).toEqual({ error: "invalid_body" });
		expect(chainMethods(gateway)).toEqual([]);
	});

	it("AP-25 ok=false token-account or blockhash read → 502 chain_unavailable, no signing", async () => {
		const { gateway, firm, draftId } = await setup();
		gateway.chain.answer.tokenAccount = async () =>
			chainFail(ErrorKind.Retryable, "rpc down");
		const noAccount = await unsigned(gateway, draftId, firm.mcpToken);
		expect(await expectJson(noAccount, 502)).toEqual({
			error: "chain_unavailable",
		});
		expect(chainMethods(gateway)).toEqual(["tokenAccount"]);

		holding(gateway, READY);
		gateway.chain.answer.latestBlockhash = async () =>
			chainFail(ErrorKind.Retryable, "rpc down");
		gateway.chain.calls.length = 0;
		const noBlockhash = await unsigned(gateway, draftId, firm.mcpToken);
		expect(await expectJson(noBlockhash, 502)).toEqual({
			error: "chain_unavailable",
		});
		expect(chainMethods(gateway)).toEqual(["tokenAccount", "latestBlockhash"]);
	});

	it("AP-25 a thrown chain read answers 500 without a blockhash read or signing (characterization)", async () => {
		const { gateway, firm, draftId } = await setup();
		gateway.chain.answer.tokenAccount = async () => {
			throw new Error("socket hang up");
		};
		const res = await unsigned(gateway, draftId, firm.mcpToken);
		expect(res.status).toBe(500);
		expect(await res.text()).not.toContain("socket hang up");
		expect(chainMethods(gateway)).toEqual(["tokenAccount"]);
	});

	it("AP-26 preflight failing → 503 not_ready", async () => {
		const { gateway, firm, draftId } = await setup();
		gateway.problems.push("hold wallet needs at least 0.05 SOL for fees");
		const res = await unsigned(gateway, draftId, firm.mcpToken);
		expect(res.status).toBe(503);
		expect(res.headers.get("Retry-After")).toBe("30");
		expect(await expectJson(res, 503)).toEqual({
			error: "not_ready",
			reasons: ["hold wallet needs at least 0.05 SOL for fees"],
		});
		expect(chainMethods(gateway)).toEqual([]);
	});
});
