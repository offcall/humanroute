// env -> Config. Collects every problem so one start shows all of them.
import { DEFAULTS } from "./defaults.js";
import { readKeypair } from "./keypair.js";
import { parseConfigV2 } from "./parseV2.js";
import { Commitment, type Config, type Env, type Parsed } from "./types.js";
import {
	parseCommitment,
	parseFeeBps,
	parseInteger,
	parseNetwork,
	parsePubkey,
	parseSecretValue,
	parseUrl,
	parseUsdc,
} from "./values.js";

// EXPERT_WALLET wins; when empty the address comes from the expert keypair file.
const expertWallet = (
	explicit: string,
	keypairPath: string,
): Parsed<string> => {
	if (explicit) {
		return parsePubkey("EXPERT_WALLET", explicit);
	}
	const keypair = readKeypair(keypairPath);
	if (!keypair.ok) {
		return { ok: false, error: `EXPERT_WALLET is empty and ${keypair.error}` };
	}
	return { ok: true, value: keypair.value.publicKey.toBase58() };
};

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

	const priceUnits = take(parseUsdc("PRICE_USDC", get("PRICE_USDC")), 0n);
	if (priceUnits === 0n && errors.length === 0) {
		errors.push("PRICE_USDC must be greater than 0");
	}
	const feeBps = take(parseFeeBps("FEE_PCT", get("FEE_PCT")), 0n);
	const expertKeypairPath = get("EXPERT_KEYPAIR_PATH");
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
		expertKeypairPath,
		expertWallet: take(
			expertWallet(get("EXPERT_WALLET"), expertKeypairPath),
			"",
		),
		priceUnits,
		feeBps,
		releaseUnits: priceUnits - (priceUnits * feeBps) / 10_000n,
		refundUnits: priceUnits,
		slaSeconds: take(
			parseInteger("SLA_SECONDS", get("SLA_SECONDS"), 5, 86_400),
			0,
		),
		inboxToken: take(parseSecretValue("INBOX_TOKEN", get("INBOX_TOKEN")), ""),
		statusSecret: take(
			parseSecretValue("STATUS_SECRET", get("STATUS_SECRET")),
			"",
		),
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
