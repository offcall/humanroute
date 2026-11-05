// v2 env fields. Shares get/take with parseConfig so all errors are collected together.
import { type ConfigV2, type Parsed, TimerMode } from "./types.js";
import { parseInteger, parsePubkey, parseUrl, parseUsdc } from "./values.js";
import {
	parseBps,
	parseNonEmpty,
	parseRequired,
	parseTimerMode,
	parseWindow,
	WINDOW_PRESETS,
} from "./valuesV2.js";
import { parseVapid } from "./vapid.js";

type Get = (name: string) => string;
type Take = <T = unknown>(parsed: Parsed<T>, fallback: T) => T;

const BPS_TOTAL = 10_000n;
const MAX_TTL = 31_536_000;

export const parseConfigV2 = (
	get: Get,
	take: Take,
	rawEnv: Get,
	fail: (message: string) => void,
): ConfigV2 => {
	const price = parseUsdc("TASK_PRICE_USDC", get("TASK_PRICE_USDC"));
	if (price.ok && price.value === 0n) {
		fail("TASK_PRICE_USDC must be greater than 0");
	}
	const taskPriceUnits = take(price, 0n);
	const timerMode = take(
		parseTimerMode("TIMER_MODE", get("TIMER_MODE")),
		TimerMode.Video,
	);
	const preset = WINDOW_PRESETS[timerMode];
	const linguistShareBps = take(
		parseBps("LINGUIST_SHARE_BPS", get("LINGUIST_SHARE_BPS")),
		0n,
	);
	const agencyShareBps = take(
		parseBps("AGENCY_SHARE_BPS", get("AGENCY_SHARE_BPS")),
		0n,
	);
	const feeShareBps = take(parseBps("FEE_SHARE_BPS", get("FEE_SHARE_BPS")), 0n);
	if (linguistShareBps + agencyShareBps + feeShareBps !== BPS_TOTAL) {
		fail(
			"LINGUIST_SHARE_BPS, AGENCY_SHARE_BPS and FEE_SHARE_BPS must sum to 10000",
		);
	}
	const ttl = (name: string): number =>
		take(parseInteger(name, get(name), 1, MAX_TTL), 0);
	return {
		taskPriceUnits,
		timerMode,
		claimWindowSeconds: take(
			parseWindow(
				"CLAIM_WINDOW_SECONDS",
				rawEnv("CLAIM_WINDOW_SECONDS"),
				preset.claim,
			),
			0,
		),
		workWindowSeconds: take(
			parseWindow(
				"WORK_WINDOW_SECONDS",
				rawEnv("WORK_WINDOW_SECONDS"),
				preset.work,
			),
			0,
		),
		linguistShareBps,
		agencyShareBps,
		feeShareBps,
		feeWallet: take(
			parseRequired("FEE_WALLET", get("FEE_WALLET"), parsePubkey),
			"",
		),
		publicBaseUrl: take(
			parseRequired("PUBLIC_BASE_URL", get("PUBLIC_BASE_URL"), parseUrl),
			"",
		),
		mcpPublicUrl: take(
			parseRequired("MCP_PUBLIC_URL", get("MCP_PUBLIC_URL"), parseUrl),
			"",
		),
		draftTtlSeconds: ttl("DRAFT_TTL_SECONDS"),
		sessionTtlSeconds: ttl("SESSION_TTL_SECONDS"),
		nonceTtlSeconds: ttl("NONCE_TTL_SECONDS"),
		webDistDir: take(parseNonEmpty("WEB_DIST_DIR", get("WEB_DIST_DIR")), ""),
		vapid: parseVapid(rawEnv, fail),
	};
};
