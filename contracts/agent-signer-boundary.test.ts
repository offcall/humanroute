// Sign.mjs fails closed on framing and the fee policy (ADR 0040, finding 5). Valid messages come
// from the gateway's own builder; every refusal is a real child run with a temp HOME.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { WALLETS } from "../src/testing/index.js";
import {
	type AgentHome,
	agentHome,
	dataOf,
	expectRefused,
	expectSigned,
	gatewayMessage,
	LIMIT,
	NOT_OURS,
	PRICE,
	recompile,
	SIGNER_CONFIG,
	TRANSFER,
	u32Data,
	u64Data,
	withInstruction,
} from "./agent-signer.js";

const MALFORMED = "malformed message:";

let agent: AgentHome;
beforeAll(() => {
	agent = agentHome();
});
afterAll(() => {
	agent.remove();
});

const sign = (bytes: Buffer) => agent.sign(bytes.toString("base64"));

// v0 layout: [0x80, 3 header bytes, key count (compact-u16), keys...]; the key count is at byte 4.
const withKeyCount = (prefix: number[]) => {
	const bytes = gatewayMessage();
	return Buffer.concat([
		bytes.subarray(0, 4),
		Buffer.from(prefix),
		bytes.subarray(5),
	]);
};

describe("the signer rejects malformed framing", () => {
	const valid = gatewayMessage();
	const rows: [string, Buffer, string][] = [
		["a truncated buffer (last byte cut)", valid.subarray(0, -1), MALFORMED],
		["a buffer cut inside the account keys", valid.subarray(0, 40), MALFORMED],
		[
			"a truncated compact length",
			Buffer.from([0x80, 2, 1, 4, 0x88]),
			MALFORMED,
		],
		["a key count beyond the buffer", withKeyCount([0x7f]), MALFORMED],
		[
			"a non-canonical key count",
			withKeyCount([0x88, 0x00]),
			`${MALFORMED} non-canonical length`,
		],
		[
			"a length prefix longer than 3 bytes",
			withKeyCount([0x88, 0x80, 0x80, 0x00]),
			MALFORMED,
		],
		[
			"trailing bytes",
			Buffer.concat([valid, Buffer.from([0])]),
			`${MALFORMED} trailing bytes`,
		],
		[
			"an out-of-range account index",
			recompile(
				valid,
				withInstruction(TRANSFER, (ix) => ({
					...ix,
					accountKeyIndexes: [2, 4, 3, 9],
				})),
			),
			`${MALFORMED} key index out of range`,
		],
		[
			"an out-of-range program index",
			recompile(
				valid,
				withInstruction(LIMIT, (ix) => ({ ...ix, programIdIndex: 200 })),
			),
			`${MALFORMED} key index out of range`,
		],
		[
			"a 6-byte compute limit",
			recompile(
				valid,
				withInstruction(LIMIT, dataOf([...u32Data(2, 20_000), 0])),
			),
			NOT_OURS,
		],
		[
			"an 8-byte compute price",
			recompile(
				valid,
				withInstruction(PRICE, dataOf(u64Data(3, 1n).subarray(0, 8))),
			),
			NOT_OURS,
		],
		["an empty message", Buffer.alloc(0), MALFORMED],
		[
			"a message above 1232 bytes",
			Buffer.concat([valid, Buffer.alloc(1232)]),
			`${MALFORMED} longer than 1232 bytes`,
		],
	];

	test.each(rows)(
		"%s → fail closed, zero signature output",
		(_name, bytes, reason) => {
			expectRefused(sign(bytes), reason);
		},
	);

	test("non-canonical base64 → fail closed", () => {
		const text = valid.toString("base64");
		for (const encoded of [`${text}!`, text.replace(/=+$/, ""), ` ${text}`]) {
			expectRefused(agent.sign(encoded), `${MALFORMED} not canonical base64`);
		}
	});

	const files: [string, { key?: string; config?: string }][] = [
		["a key file that is not JSON", { key: "not json" }],
		[
			"a key file of 63 bytes",
			{
				key: JSON.stringify([...WALLETS.agent.keypair.secretKey].slice(0, 63)),
			},
		],
		[
			"a public half of another key",
			{
				key: JSON.stringify([
					...WALLETS.agent.keypair.secretKey.subarray(0, 32),
					...WALLETS.firm.keypair.publicKey.toBytes(),
				]),
			},
		],
		[
			"a config destination that is not an address",
			{ config: JSON.stringify({ ...SIGNER_CONFIG, destination: "0OIl" }) },
		],
		[
			"a config without a mint",
			{ config: JSON.stringify({ ...SIGNER_CONFIG, mint: undefined }) },
		],
		[
			"a config address of 31 bytes",
			{
				config: JSON.stringify({
					...SIGNER_CONFIG,
					source: "1111111111111111111111111111111",
				}),
			},
		],
	];

	test.each(files)("%s → bad key or config file", (_name, broken) => {
		const home = agentHome(broken);
		try {
			expectRefused(
				home.sign(valid.toString("base64")),
				"bad key or config file:",
			);
		} finally {
			home.remove();
		}
	});
});

describe("the signer refuses the agent key as fee payer, a signer count other than 2 and compute values outside the fee policy", () => {
	test("signs the gateway's own message (header 2,1,4; 8 keys; 367 bytes)", () => {
		const message = gatewayMessage();
		expect([...message.subarray(1, 5)]).toEqual([2, 1, 4, 8]);
		expect(message).toHaveLength(367);
		expectSigned(sign(message), message);
	});

	test("refuses the agent key as fee payer", () => {
		const agentPays = gatewayMessage({ feePayer: WALLETS.agent.address });
		expectRefused(sign(agentPays), "the agent key must not pay the fee");
	});

	const signerCounts: [string, number, number][] = [
		["1 required signer", 1, 0],
		["the agent key writable", 2, 0],
	];

	test.each(signerCounts)("refuses %s", (_name, required, readonlySigned) => {
		const bytes = recompile(gatewayMessage(), (parts) => ({
			...parts,
			header: {
				...parts.header,
				numRequiredSignatures: required,
				numReadonlySignedAccounts: readonlySigned,
			},
		}));
		expectRefused(sign(bytes), NOT_OURS);
	});

	const limitTo = (units: number) =>
		recompile(
			gatewayMessage(),
			withInstruction(LIMIT, dataOf(u32Data(2, units))),
		);
	const priceTo = (microLamports: bigint) =>
		recompile(
			gatewayMessage(),
			withInstruction(PRICE, dataOf(u64Data(3, microLamports))),
		);

	test("compute limit: 40000 signed, 40001 refused", () => {
		const atCap = limitTo(40_000);
		expectSigned(sign(atCap), atCap);
		expectRefused(sign(limitTo(40_001)), "compute limit 40001 above 40000");
		expectRefused(
			sign(limitTo(0xffff_ffff)),
			"compute limit 4294967295 above 40000",
		);
	});

	test("compute price: 1000 microlamports signed, 1001 refused", () => {
		const atCap = priceTo(1000n);
		expectSigned(sign(atCap), atCap);
		expectRefused(sign(priceTo(1001n)), "compute price 1001 above 1000");
		expectRefused(
			sign(priceTo(2n ** 64n - 1n)),
			"compute price 18446744073709551615 above 1000",
		);
	});
});
