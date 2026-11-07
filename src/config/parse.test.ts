// Env -> Config: defaults, presets and refusals reported together (ADR 0023, 0024, 0029).
import { describe, expect, test } from "vitest";
import { parseConfig } from "./parse.js";
import { type Env, TimerMode } from "./types.js";

const FEE = "11111111111111111111111111111112";
const BASE: Env = {
	FEE_WALLET: FEE,
	PUBLIC_BASE_URL: "https://humanroute.test",
	MCP_PUBLIC_URL: "https://mcp.humanroute.test/mcp",
};

// Synthetic, format-valid VAPID values (not a real key pair).
const VAPID_PUBLIC = Buffer.concat([
	Buffer.of(4),
	Buffer.alloc(64, 1),
]).toString("base64url");
const VAPID_PRIVATE = Buffer.alloc(32, 2).toString("base64url");
const VAPID: Env = {
	VAPID_PUBLIC_KEY: VAPID_PUBLIC,
	VAPID_PRIVATE_KEY: VAPID_PRIVATE,
	VAPID_SUBJECT: "mailto:ops@humanroute.test",
};

const errorOf = (env: Env): string => {
	const parsed = parseConfig(env);
	if (parsed.ok) {
		throw new Error("expected the config to be refused");
	}

	return parsed.error;
};

const parsedValue = (env: Env) => {
	const parsed = parseConfig(env);
	if (!parsed.ok) {
		throw new Error(parsed.error);
	}

	return parsed.value;
};

describe("parseConfig", () => {
	test("a minimal env yields the defaults", () => {
		const config = parsedValue(BASE);
		expect(config).toMatchObject({
			rpcUrl: "https://api.devnet.solana.com",
			network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
			usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
			timerMode: TimerMode.Video,
			claimWindowSeconds: 60,
			workWindowSeconds: 180,
			taskPriceUnits: 500_000n,
			linguistShareBps: 8000n,
			agencyShareBps: 1800n,
			feeShareBps: 200n,
			feeWallet: FEE,
			vapid: null,
		});
	});

	test("timer presets are video 60/180 and public 1800/3600 and explicit windows override them", () => {
		const windows = (env: Env) => {
			const config = parsedValue({ ...BASE, ...env });
			return [config.claimWindowSeconds, config.workWindowSeconds];
		};
		expect(windows({ TIMER_MODE: "video" })).toEqual([60, 180]);
		expect(windows({ TIMER_MODE: "public" })).toEqual([1800, 3600]);
		expect(
			windows({
				TIMER_MODE: "public",
				CLAIM_WINDOW_SECONDS: "5",
				WORK_WINDOW_SECONDS: "7",
			}),
		).toEqual([5, 7]);
	});
});

describe("config refusals, all reported in one error", () => {
	test("several problems are reported together", () => {
		const error = errorOf({
			...BASE,
			PORT: "0",
			TIMER_MODE: "slow",
			RPC_URL: "ftp://x",
		});
		expect(error.split("\n")).toHaveLength(3);
		expect(error).toContain("PORT");
		expect(error).toContain("TIMER_MODE");
		expect(error).toContain("RPC_URL");
	});

	test("shares must sum to 10000", () => {
		expect(errorOf({ ...BASE, FEE_SHARE_BPS: "201" })).toContain(
			"must sum to 10000",
		);
		expect(
			parsedValue({ ...BASE, LINGUIST_SHARE_BPS: "7999", FEE_SHARE_BPS: "201" })
				.feeShareBps,
		).toBe(201n);
	});

	test.each(["0", "-1", "0.0000001", "abc"])("refuses price %s", (price) => {
		expect(errorOf({ ...BASE, TASK_PRICE_USDC: price })).toContain(
			"TASK_PRICE_USDC",
		);
	});

	test("accepts the smallest price 0.000001", () => {
		expect(
			parsedValue({ ...BASE, TASK_PRICE_USDC: "0.000001" }).taskPriceUnits,
		).toBe(1n);
	});

	test("accepts all three VAPID values", () => {
		expect(parsedValue({ ...BASE, ...VAPID }).vapid).toEqual({
			publicKey: VAPID_PUBLIC,
			privateKey: VAPID_PRIVATE,
			subject: "mailto:ops@humanroute.test",
		});
		const https = { ...VAPID, VAPID_SUBJECT: "https://humanroute.test" };
		expect(parsedValue({ ...BASE, ...https }).vapid?.subject).toBe(
			"https://humanroute.test",
		);
	});

	test.each([
		["public only", ["VAPID_PUBLIC_KEY"]],
		["private only", ["VAPID_PRIVATE_KEY"]],
		["subject only", ["VAPID_SUBJECT"]],
		["public + private", ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]],
		["public + subject", ["VAPID_PUBLIC_KEY", "VAPID_SUBJECT"]],
		["private + subject", ["VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]],
	])("refuses a partial VAPID set: %s", (_, names) => {
		const partial = Object.fromEntries(
			names.map((name) => [name, VAPID[name]]),
		);
		const error = errorOf({ ...BASE, ...partial });
		expect(error).toContain("must be set together");
		expect(error).not.toContain(VAPID_PRIVATE);
	});

	const badPrivate = Buffer.alloc(31, 3).toString("base64url");
	test.each([
		[
			"public 64 bytes",
			{ VAPID_PUBLIC_KEY: Buffer.alloc(64, 4).toString("base64url") },
			"VAPID_PUBLIC_KEY",
		],
		[
			"public without 0x04",
			{ VAPID_PUBLIC_KEY: Buffer.alloc(65, 1).toString("base64url") },
			"VAPID_PUBLIC_KEY",
		],
		[
			"public with + /",
			{ VAPID_PUBLIC_KEY: `${VAPID_PUBLIC.slice(0, -2)}+/` },
			"VAPID_PUBLIC_KEY",
		],
		[
			"private 31 bytes",
			{ VAPID_PRIVATE_KEY: badPrivate },
			"VAPID_PRIVATE_KEY",
		],
		[
			"private 33 bytes",
			{ VAPID_PRIVATE_KEY: Buffer.alloc(33, 3).toString("base64url") },
			"VAPID_PRIVATE_KEY",
		],
		[
			"subject http",
			{ VAPID_SUBJECT: "http://humanroute.test" },
			"VAPID_SUBJECT",
		],
		["subject plain text", { VAPID_SUBJECT: "ops" }, "VAPID_SUBJECT"],
	])(
		"refuses VAPID %s without echoing private material",
		(_, override, name) => {
			const env: Env = { ...BASE, ...VAPID, ...override };
			const error = errorOf(env);
			expect(error).toContain(name);
			expect(error).not.toContain(VAPID_PRIVATE);
			expect(error).not.toContain(badPrivate);
		},
	);

	test.each(["FEE_WALLET", "PUBLIC_BASE_URL", "MCP_PUBLIC_URL"])(
		"%s is required",
		(name) => {
			expect(errorOf({ ...BASE, [name]: "" })).toContain(`${name} is required`);
			expect(errorOf({ ...BASE, [name]: "   " })).toContain(
				`${name} is required`,
			);
		},
	);
});
