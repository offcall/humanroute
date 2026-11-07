// Auto-pay checks before a delegate payment is built (ADR 0036, failure table rows 10-12).
import { describe, expect, test } from "vitest";
import { WALLETS } from "../testing/index.js";
import { checkAutopay } from "./autopay.js";
import type { FirmTokenAccount } from "./types.js";

const ADDRESS = "FirmUsdcAccount1111111111111111111111111111";
const TOTAL = 1_000_000n;

const held = (
	amount: bigint,
	delegatedAmount: bigint,
	delegate: string | null = WALLETS.agent.address,
): FirmTokenAccount => ({
	exists: true,
	address: ADDRESS,
	amount,
	delegate,
	delegatedAmount,
});

describe("checkAutopay refusals in precedence order", () => {
	const rows: [string, FirmTokenAccount, ReturnType<typeof checkAutopay>][] = [
		[
			"no USDC account → no_usdc_account with the account address",
			{ exists: false, address: ADDRESS },
			{
				ok: false,
				refusal: { error: "no_usdc_account", detail: { account: ADDRESS } },
			},
		],
		[
			"null delegate → autopay_off, also when the balance is short",
			held(1n, TOTAL, null),
			{ ok: false, refusal: { error: "autopay_off", detail: {} } },
		],
		[
			"zero allowance → autopay_off, also when the balance is short",
			held(1n, 0n),
			{ ok: false, refusal: { error: "autopay_off", detail: {} } },
		],
		[
			"allowance < total → autopay_limit with leftUnits, also when the balance is short",
			held(1n, TOTAL - 1n),
			{
				ok: false,
				refusal: { error: "autopay_limit", detail: { leftUnits: "999999" } },
			},
		],
		[
			"balance < total → insufficient_usdc with balanceUnits",
			held(TOTAL - 1n, TOTAL),
			{
				ok: false,
				refusal: {
					error: "insufficient_usdc",
					detail: { balanceUnits: "999999" },
				},
			},
		],
		[
			"allowance = balance = total → pass with the delegate",
			held(TOTAL, TOTAL),
			{ ok: true, delegate: WALLETS.agent.address },
		],
	];

	test.each(rows)("%s", (_name, account, expected) => {
		expect(checkAutopay(account, TOTAL)).toEqual(expected);
	});
});
