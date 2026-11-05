// HumanRoute agent key setup (ADR 0036). Node built-ins only. Run after downloading sign.mjs next to it:
// node ~/.humanroute/setup.mjs --source <firm USDC account> --dest <HumanRoute USDC account> --mint <mint> --cabinet <url>
// Creates ~/.humanroute/agent-key.json (mode 600) once, writes config.json, prints the public key.
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { base58, CONFIG_FILE, HOME_DIR, KEY_FILE, readKey } from "./sign.mjs";

const { values } = parseArgs({
	options: {
		source: { type: "string" },
		dest: { type: "string" },
		mint: { type: "string" },
		cabinet: { type: "string" },
	},
});
const { source, dest, mint, cabinet } = values;
if (!source || !dest || !mint || !cabinet) {
	console.error(
		"usage: node setup.mjs --source <account> --dest <account> --mint <mint> --cabinet <url>",
	);
	process.exit(1);
}

mkdirSync(HOME_DIR, { recursive: true, mode: 0o700 });
if (existsSync(KEY_FILE)) {
	console.log(`Keeping the existing agent key ${KEY_FILE}`);
} else {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	const seed = privateKey
		.export({ format: "der", type: "pkcs8" })
		.subarray(-32);
	const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
	writeFileSync(KEY_FILE, JSON.stringify([...seed, ...raw]), {
		mode: 0o600,
		flag: "wx",
	});
	console.log(`Created the agent key ${KEY_FILE}`);
}
writeFileSync(
	CONFIG_FILE,
	JSON.stringify({ source, destination: dest, mint }, null, 2),
	{ mode: 0o600 },
);

const agent = base58(readKey().subarray(32, 64));
console.log(`Agent public key: ${agent}`);
console.log(
	`Enable auto-pay for it in the firm cabinet: ${cabinet}?agent=${agent}`,
);
