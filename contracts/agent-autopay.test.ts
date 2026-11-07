// Auto-pay across processes (ADR 0036, 0040): the gateway builds the payment, sign.mjs (a real child
// with a temp HOME) checks and signs it, MCP puts the signature in and pays over x402.
import { spawnSync } from "node:child_process";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
	MessageV0,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPayClient } from "../mcp/payGateway.js";
import { pay } from "../mcp/payTool.js";
import type { PayClient, Prepared } from "../mcp/payTypes.js";
import { takePrepared } from "../mcp/pending.js";
import { prepare } from "../mcp/prepareTool.js";
import { signedTransaction } from "../mcp/signature.js";
import { paymentId } from "../src/orders/paymentId.js";
import {
	chainOk,
	createDraft,
	createTestGateway,
	expectJson,
	registerFirm,
	send,
	type TestGateway,
	type TestWallet,
	textField,
	WALLETS,
} from "../src/testing/index.js";
import {
	AGENT_DIR,
	agentHome,
	ataOf,
	dataOf,
	expectRefused,
	expectSigned,
	gatewayMessage,
	NOT_OURS,
	recompile,
	runScript,
	tempHome,
	u32Data,
	u64Data,
	withInstruction,
} from "./agent-signer.js";

const BASE_URL = "http://humanroute.test";
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
// MCP's clock for prepare_payment and pay_task; any fixed instant works.
const gatewayNow = () => 0;
const LIMIT = 0;
const PRICE = 1;
const TRANSFER = 2;
const MEMO = 3;

afterEach(() => {
	vi.unstubAllGlobals();
});

// Ed25519 signature over raw bytes, base64, as any other key would produce it.
const signBytes = (wallet: TestWallet, message: Buffer) =>
	sign(
		null,
		message,
		createPrivateKey({
			key: Buffer.concat([
				PKCS8_PREFIX,
				wallet.keypair.secretKey.subarray(0, 32),
			]),
			format: "der",
			type: "pkcs8",
		}),
	).toString("base64");

// A test gateway whose firm has auto-pay on for `delegate.value`, and the signer config the
// cabinet's GET /api/firm/autopay hands to setup.mjs.
const autopayGateway = async () => {
	const gateway = createTestGateway();
	const delegate = { value: WALLETS.agent.address };
	gateway.chain.answer.tokenAccount = async (owner) =>
		chainOk({
			exists: true,
			address: ataOf(owner, gateway.config.usdcMint),
			amount: 5_000_000n,
			delegate: delegate.value,
			delegatedAmount: 5_000_000n,
		});
	const firm = await registerFirm(gateway.app, WALLETS.firm);
	const status = await expectJson(
		await send(gateway.app, "GET", "/api/firm/autopay", {
			cookie: firm.cookie,
		}),
		200,
	);
	const config = {
		source: textField(status, "account"),
		destination: textField(status, "payToAccount"),
		mint: textField(status, "mint"),
	};
	const draftId = textField(
		await createDraft(gateway.app, firm.mcpToken),
		"draftId",
	);
	return { gateway, firm, config, draftId, delegate };
};

const unsignedMessage = async (
	gateway: TestGateway,
	token: string,
	draftId: string,
) => {
	const body = await expectJson(
		await send(gateway.app, "POST", `/api/orders/draft/${draftId}/unsigned`, {
			bearer: token,
			body: { feePayer: WALLETS.facilitator.address },
		}),
		200,
	);
	return textField(body, "message");
};

// MCP's real pay client against the in-process gateway; every PAYMENT-SIGNATURE sent is recorded.
const mcpClient = (gateway: TestGateway) => {
	vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) =>
		gateway.app.request(input, init),
	);
	const real = createPayClient(BASE_URL);
	const headers: string[] = [];
	const client: PayClient = {
		...real,
		pay: (draftId, header) => {
			headers.push(header);
			return real.pay(draftId, header);
		},
	};
	return { client, headers };
};

const prepared = async (
	client: PayClient,
	token: string,
	draftId: string,
): Promise<Prepared> => {
	const now = gatewayNow();
	const reply = await prepare(client, token, draftId, now);
	expect(reply.isError).toBe(false);
	const kept = takePrepared(token, draftId, now);
	if (kept === undefined) {
		throw new Error("prepare_payment kept no payment");
	}
	return kept;
};

const replyText = (reply: Awaited<ReturnType<typeof pay>>) =>
	reply.content.map((part) => (part.type === "text" ? part.text : "")).join("");

describe("auto-pay contract: gateway, sign.mjs and MCP", () => {
	it("CT-01 sign.mjs accepts the transaction the gateway builds and returns its amount", async () => {
		const { gateway, firm, config, draftId } = await autopayGateway();
		const message = await unsignedMessage(gateway, firm.mcpToken, draftId);
		const bytes = Buffer.from(message, "base64");

		const signURL = pathToFileURL(join(AGENT_DIR, "sign.mjs")).href;
		const direct = spawnSync(
			process.execPath,
			[
				"--input-type=module",
				"-e",
				`import { checkPayment } from ${JSON.stringify(signURL)};
const [message, config, agent] = process.argv.slice(1);
const units = checkPayment(Buffer.from(message, "base64"), JSON.parse(config), agent);
console.log(typeof units, String(units));`,
				message,
				JSON.stringify(config),
				WALLETS.agent.address,
			],
			{ encoding: "utf8", env: { PATH: process.env.PATH ?? "" } },
		);
		expect(direct.stderr).toBe("");
		expect(direct.stdout).toBe("bigint 1000000\n");

		const home = agentHome({ config: JSON.stringify(config) });
		try {
			const run = home.sign(message);
			expectSigned(run, bytes);
			expect(run.stderr).toContain(
				`Signing a HumanRoute payment of 1.000000 USDC with agent key ${WALLETS.agent.address}`,
			);
		} finally {
			home.remove();
		}
	});

	it("CT-06 MCP accepts the delegate's signature and puts it in the delegate's signature slot", async () => {
		const { gateway, firm, config, draftId, delegate } = await autopayGateway();
		const home = tempHome();
		try {
			const setup = runScript(home, "setup.mjs", [
				...["--source", config.source, "--dest", config.destination],
				...["--mint", config.mint, "--cabinet", `${BASE_URL}/firm/jobs`],
			]);
			const agentKey = /Agent public key: (\S+)/.exec(setup.stdout)?.[1];
			if (agentKey === undefined) {
				throw new Error(`setup.mjs printed no key: ${setup.stdout}`);
			}
			delegate.value = agentKey;
			const { client } = mcpClient(gateway);
			const payment = await prepared(client, firm.mcpToken, draftId);
			expect(payment.signer).toBe(agentKey);

			const run = runScript(home, "sign.mjs", [payment.message]);
			const signature = expectSigned(
				run,
				Buffer.from(payment.message, "base64"),
				agentKey,
			);
			const signed = signedTransaction(payment, run.stdout);
			if (!signed.ok) {
				throw new Error(signed.error);
			}
			const transaction = VersionedTransaction.deserialize(
				Buffer.from(signed.value, "base64"),
			);
			const unsigned = VersionedTransaction.deserialize(
				Buffer.from(payment.transaction, "base64"),
			);
			const keys = transaction.message.staticAccountKeys.map(String);
			expect(keys.slice(0, 2)).toEqual([WALLETS.facilitator.address, agentKey]);
			expect(Buffer.from(transaction.signatures[1] ?? [])).toEqual(signature);
			expect(transaction.signatures[0]).toEqual(unsigned.signatures[0]);
			expect(transaction.signatures[0]?.every((byte) => byte === 0)).toBe(true);
		} finally {
			rmSync(home, { recursive: true, force: true });
		}
	});

	it("CT-07 MCP refuses a signature from another key and one that is not 64 bytes, without calling the gateway", async () => {
		const { gateway, firm, draftId } = await autopayGateway();
		const { client, headers } = mcpClient(gateway);
		const payment = await prepared(client, firm.mcpToken, draftId);
		const message = Buffer.from(payment.message, "base64");
		const right = Buffer.from(signBytes(WALLETS.agent, message), "base64");
		const now = gatewayNow();

		const refused: [string, string, string][] = [
			[
				"another key",
				signBytes(WALLETS.linguist, message),
				"the signature does not match",
			],
			["63 bytes", right.subarray(0, 63).toString("base64"), "not 64 bytes"],
			[
				"65 bytes",
				Buffer.concat([right, Buffer.from([0])]).toString("base64"),
				"not 64 bytes",
			],
		];
		for (const [name, signature, reason] of refused) {
			const reply = await pay(client, firm.mcpToken, draftId, signature, now);
			expect(reply.isError, name).toBe(true);
			expect(replyText(reply), name).toContain(reason);
		}
		expect(headers).toEqual([]);
		expect(gateway.facilitator.calls).toEqual({ verify: 0, settle: 0 });

		const reply = await pay(
			client,
			firm.mcpToken,
			draftId,
			right.toString("base64"),
			now,
		);
		expect(reply.isError).toBe(false);
		expect(replyText(reply)).toContain("Paid:");
		expect(headers).toHaveLength(1);
		expect(gateway.facilitator.calls.settle).toBe(1);
	});

	it("CT-08 signing does not change the message, so the payment id stays the same", async () => {
		const { gateway, firm, draftId } = await autopayGateway();
		const { client, headers } = mcpClient(gateway);
		const payment = await prepared(client, firm.mcpToken, draftId);
		const message = Buffer.from(payment.message, "base64");
		const signature = signBytes(WALLETS.agent, message);

		const reply = await pay(client, firm.mcpToken, draftId, signature, 0);
		expect(reply.isError).toBe(false);
		const [header] = headers;
		if (header === undefined) {
			throw new Error("pay_task sent no payment");
		}
		const unsignedHeader = Buffer.from(
			JSON.stringify({ payload: { transaction: payment.transaction } }),
		).toString("base64");
		const expected = createHash("sha256").update(message).digest("hex");
		expect(paymentId(unsignedHeader)).toBe(expected);
		expect(paymentId(header)).toBe(expected);

		const first = await client.pay(draftId, header);
		const again = await client.pay(draftId, header);
		expect(again).toEqual(first);
		expect(gateway.facilitator.calls.settle).toBe(1);
	});
});

const legacyOf = (bytes: Buffer) =>
	Buffer.from(
		TransactionMessage.decompile(MessageV0.deserialize(bytes))
			.compileToLegacyMessage()
			.serialize(),
	);

describe("CT-02T sign.mjs refuses a message that is not a HumanRoute payment", () => {
	const valid = gatewayMessage();
	const memoData = (bytes: number[] | Buffer) =>
		recompile(valid, withInstruction(MEMO, dataOf(bytes)));
	const transferData = (bytes: Buffer) =>
		recompile(valid, withInstruction(TRANSFER, dataOf(bytes)));
	const checked = (tag: number, amount: bigint, decimals: number) =>
		u64Data(tag, amount, [decimals]);

	const rows: [string, Buffer, string][] = [
		[
			"CT-02 an extra instruction",
			recompile(valid, (parts) => ({
				...parts,
				instructions: [...parts.instructions, ...parts.instructions.slice(3)],
			})),
			NOT_OURS,
		],
		[
			"CT-02 a missing memo",
			recompile(valid, (parts) => ({
				...parts,
				instructions: parts.instructions.slice(0, 3),
			})),
			NOT_OURS,
		],
		[
			"CT-02 a missing transfer",
			recompile(valid, (parts) => ({
				...parts,
				instructions: parts.instructions.filter((_, at) => at !== TRANSFER),
			})),
			NOT_OURS,
		],
		[
			"CT-02 swapped compute instructions",
			recompile(valid, (parts) => {
				const [limit, price, ...rest] = parts.instructions;
				return limit && price
					? { ...parts, instructions: [price, limit, ...rest] }
					: parts;
			}),
			NOT_OURS,
		],
		[
			"CT-03 another source",
			gatewayMessage({ firmWallet: WALLETS.agency.address }),
			NOT_OURS,
		],
		[
			"CT-03 another mint",
			gatewayMessage({ mint: WALLETS.linguist.address }),
			NOT_OURS,
		],
		[
			"CT-03 another destination",
			gatewayMessage({ payTo: WALLETS.agency.address }),
			NOT_OURS,
		],
		[
			"CT-03 another authority",
			gatewayMessage({ delegate: WALLETS.linguist.address }),
			NOT_OURS,
		],
		[
			"CT-03 the fee payer as authority",
			recompile(
				valid,
				withInstruction(TRANSFER, (ix) => ({
					...ix,
					accountKeyIndexes: [...ix.accountKeyIndexes.slice(0, 3), 0],
				})),
			),
			NOT_OURS,
		],
		[
			"CT-04 wrong decimals",
			transferData(checked(12, 1_000_000n, 9)),
			NOT_OURS,
		],
		["CT-04 a zero amount", transferData(checked(12, 0n, 6)), NOT_OURS],
		[
			"CT-04 an address lookup table",
			recompile(valid, (parts) => ({
				...parts,
				lookups: [
					{
						accountKey: WALLETS.fee.keypair.publicKey,
						writableIndexes: [],
						readonlyIndexes: [0],
					},
				],
			})),
			"malformed message: address lookup tables are not allowed",
		],
		[
			"CT-04 a legacy message",
			legacyOf(valid),
			"malformed message: not a v0 transaction message",
		],
		[
			"CT-04b Transfer instead of TransferChecked",
			transferData(u64Data(3, 1_000_000n)),
			NOT_OURS,
		],
		[
			"CT-04b BurnChecked instead of TransferChecked",
			transferData(checked(15, 1_000_000n, 6)),
			NOT_OURS,
		],
		[
			"CT-04b Approve instead of TransferChecked",
			transferData(u64Data(4, 1_000_000n)),
			NOT_OURS,
		],
		[
			"CT-04b a wrong compute limit discriminator",
			recompile(valid, withInstruction(LIMIT, dataOf(u32Data(3, 20_000)))),
			NOT_OURS,
		],
		[
			"CT-04b a wrong compute price discriminator",
			recompile(valid, withInstruction(PRICE, dataOf(u64Data(2, 1n)))),
			NOT_OURS,
		],
		["CT-04 an empty memo", memoData([]), NOT_OURS],
		["CT-04 a 65-byte memo", memoData(Buffer.alloc(65, 0x61)), NOT_OURS],
		["CT-04 a memo that is not UTF-8", memoData([0xff, 0xfe]), NOT_OURS],
		[
			"CT-05 the agent key not a required signer",
			recompile(valid, (parts) => ({
				...parts,
				header: { ...parts.header, numRequiredSignatures: 1 },
			})),
			NOT_OURS,
		],
	];

	it.each(rows)(
		"%s → refusal and no signature output",
		(_name, bytes, reason) => {
			const home = agentHome();
			try {
				expectRefused(home.sign(bytes.toString("base64")), reason);
			} finally {
				home.remove();
			}
		},
	);

	it("CT-05 a message for another agent key → refusal and no signature output", () => {
		const home = agentHome({ agent: WALLETS.linguist });
		try {
			expectRefused(home.sign(valid.toString("base64")), NOT_OURS);
		} finally {
			home.remove();
		}
	});
});
