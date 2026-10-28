// env -> Config. Collects every problem so one start shows all of them.
import { DEFAULTS } from "./defaults.js";
import { parseConfigV2 } from "./parseV2.js";
import { Commitment, type Config, type Env, type Parsed } from "./types.js";
import {
	parseCommitment,
	parseInteger,
	parseNetwork,
	parsePubkey,
	parseUrl,
} from "./values.js";

export const parseConfig = (env: Env): Parsed<Config> => {
	const errors: string[] = [];
	const get = (name: string): string =>
		(env[name] ?? "").trim() || (DEFAULTS[name] ?? "");
	const take = <T = unknown>(parsed: Parsed<T>, fallback: T): T => {
		if (parsed.ok) {
			return parsed.value;
		}
		errors.push(parsed.error);
		return fallback;
	};

	const config: Config = {
		rpcUrl: take(parseUrl("RPC_URL", get("RPC_URL")), ""),
		network: take(
			parseNetwork("SOLANA_NETWORK", get("SOLANA_NETWORK")),
			"invalid:network",
		),
		facilitatorUrl: take(
			parseUrl("FACILITATOR_URL", get("FACILITATOR_URL")),
			"",
		),
		usdcMint: take(parsePubkey("USDC_MINT", get("USDC_MINT")), ""),
		holdKeypairPath: get("HOLD_KEYPAIR_PATH"),
		port: take(parseInteger("PORT", get("PORT"), 1, 65_535), 0),
		dbPath: get("DB_PATH"),
		commitment: take(
			parseCommitment("COMMITMENT", get("COMMITMENT")),
			Commitment.Confirmed,
		),
		...parseConfigV2(
			get,
			take,
			(name) => (env[name] ?? "").trim(),
			(message) => errors.push(message),
		),
	};
	if (errors.length > 0) {
		return { ok: false, error: errors.join("\n") };
	}
	return { ok: true, value: config };
};
