// POST /api/firm/autopay/confirm (ADR 0045): waits for the firm's approve or revoke, then reads.
import { base58 } from "@scure/base";
import { describe, expect, test } from "vitest";
import {
	chainOk,
	createTestGateway,
	expectJson,
	registerFirm,
	send,
	signIn,
	type TestGateway,
	WALLETS,
} from "../testing/index.js";
import {
	CONFIRM_POLLS,
	ConfirmOutcome,
	waitConfirmed,
} from "./autopayConfirm.js";
import type { ChainRead, TxStatus } from "./types.js";

const SIGNATURE = base58.encode(new Uint8Array(64).fill(7));
const unseen: ChainRead<TxStatus> = { ok: true, value: { state: "unknown" } };

const confirm = (gateway: TestGateway, body: unknown, cookie?: string) =>
	send(gateway.app, "POST", "/api/firm/autopay/confirm", {
		body,
		...(cookie === undefined ? {} : { cookie }),
	});

const statuses = (answers: ChainRead<TxStatus>[]) => {
	const asked: string[] = [];
	const slept: number[] = [];
	const deps = {
		signatureStatusOf: async (signature: string) => {
			asked.push(signature);
			return answers.shift() ?? unseen;
		},
		sleep: async (millis: number) => {
			slept.push(millis);
		},
	};
	return { deps, asked, slept };
};

describe("firm auto-pay confirm", () => {
	test("a confirmed signature → 200 with the allowance read after it", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		gateway.chain.answer.tokenAccount = async () =>
			chainOk({
				exists: true,
				address: "firm-usdc",
				amount: 13_000_000n,
				delegate: WALLETS.agent.address,
				delegatedAmount: 5_000_000n,
			});

		const res = await confirm(gateway, { signature: SIGNATURE }, firm.cookie);
		const body = await expectJson(res, 200);
		expect(body).toMatchObject({
			wallet: WALLETS.firm.address,
			delegate: WALLETS.agent.address,
			allowanceUnits: "5000000",
		});
		const methods = gateway.chain.calls.map((call) => call.method);
		expect(methods.indexOf("signatureStatus")).toBeLessThan(
			methods.indexOf("tokenAccount"),
		);
		expect(gateway.chain.calls[0]?.args).toEqual([SIGNATURE]);
	});

	test("a failed transaction → 409 tx_failed and no allowance read", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		gateway.chain.answer.signatureStatus = async () =>
			chainOk({ state: "failed", error: "InsufficientFunds" });

		const res = await confirm(gateway, { signature: SIGNATURE }, firm.cookie);
		expect(await expectJson(res, 409)).toEqual({
			error: "tx_failed",
			message: "InsufficientFunds",
		});
		const methods = gateway.chain.calls.map((call) => call.method);
		expect(methods).not.toContain("tokenAccount");
	});

	test("401 without session, 403 for a non-firm session, 422 for a bad signature", async () => {
		const gateway = createTestGateway();
		const stranger = await signIn(gateway.app, WALLETS.linguist);
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		const body = { signature: SIGNATURE };

		expect(await expectJson(await confirm(gateway, body), 401)).toEqual({
			error: "unauthorized",
		});
		const other = await confirm(gateway, body, stranger);
		expect(await expectJson(other, 403)).toEqual({ error: "forbidden" });
		for (const bad of [
			{},
			{ signature: "not-base58!" },
			{ signature: WALLETS.firm.address },
		]) {
			const res = await confirm(gateway, bad, firm.cookie);
			expect(await expectJson(res, 422)).toEqual({
				error: "invalid_signature",
			});
		}
		expect(gateway.chain.calls).toEqual([]);
	});

	test("waits through unseen, pending and chain errors until confirmed", async () => {
		const { deps, asked, slept } = statuses([
			unseen,
			{ ok: false, error: "rpc down" },
			{ ok: true, value: { state: "pending" } },
			{ ok: true, value: { state: "confirmed" } },
		]);

		const result = await waitConfirmed(
			deps,
			SIGNATURE,
			new AbortController().signal,
		);
		expect(result).toEqual({ outcome: ConfirmOutcome.Confirmed });
		expect(asked).toHaveLength(4);
		expect(slept).toEqual([1000, 1000, 1000]);
	});

	test("never confirmed → not_confirmed after the last poll", async () => {
		const { deps, asked } = statuses([]);
		const result = await waitConfirmed(
			deps,
			SIGNATURE,
			new AbortController().signal,
		);
		expect(result).toEqual({ outcome: ConfirmOutcome.NotConfirmed });
		expect(asked).toHaveLength(CONFIRM_POLLS);
	});

	test("the caller leaving stops the wait", async () => {
		const { deps, asked } = statuses([]);
		deps.sleep = async () => {
			throw new Error("aborted");
		};
		const result = await waitConfirmed(
			deps,
			SIGNATURE,
			new AbortController().signal,
		);
		expect(result).toEqual({ outcome: ConfirmOutcome.NotConfirmed });
		expect(asked).toHaveLength(1);
	});
});
