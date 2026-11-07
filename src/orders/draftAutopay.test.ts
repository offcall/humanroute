// Advisory auto-pay snapshot at draft creation (ADR 0036): available only when every check
// passes, unknown when the chain cannot tell within 2 s; never builds or sends a payment.
import { describe, expect, test, vi } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	registerFirm,
	send,
	textField,
	WALLETS,
} from "../testing/index.js";
import { draftAutopay } from "./draftAutopay.js";
import {
	AutopayStatus,
	type ChainRead,
	type Draft,
	type FirmTokenAccount,
	type OrdersDeps,
} from "./types.js";

type SnapshotDeps = Pick<OrdersDeps, "firmWallet" | "tokenAccountOf" | "sleep">;

const TOTAL = 1_000_000n;
const ADDRESS = "FirmUsdcAccount1111111111111111111111111111";

const DRAFT: Draft = {
	id: "drf-1",
	firmId: "firm-1",
	text: "Take one tablet.",
	sourceLang: "en",
	targets: [{ targetLang: "es", draft: "Tome un comprimido." }],
	metaJson: null,
	priceUnits: TOTAL,
	totalUnits: TOTAL,
	taskCount: 1,
	createdAt: 0,
	orderId: null,
};

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

const deferred = <T = unknown>() => {
	let settle: (value: T) => void = () => undefined;
	const promise = new Promise<T>((done) => {
		settle = done;
	});
	return { promise, resolve: (value: T) => settle(value) };
};

const neverSleeps: SnapshotDeps["sleep"] = () => new Promise(() => undefined);

const depsWith = (
	read: SnapshotDeps["tokenAccountOf"],
	sleep = neverSleeps,
): SnapshotDeps => ({
	firmWallet: () => WALLETS.firm.address,
	tokenAccountOf: read,
	sleep,
});

const answering = (account: FirmTokenAccount) =>
	depsWith(async () => ({ ok: true, value: account }));

describe("draft auto-pay snapshot", () => {
	const rows: [string, FirmTokenAccount, AutopayStatus][] = [
		["every check passes", held(TOTAL, TOTAL), AutopayStatus.Available],
		["allowance short", held(TOTAL, TOTAL - 1n), AutopayStatus.Unavailable],
	];

	test.each(rows)(
		"the draft snapshot maps checkAutopay: %s",
		async (_name, account, expected) => {
			expect(await draftAutopay(answering(account), DRAFT)).toBe(expected);
		},
	);

	test("unknown when the firm has no wallet or the chain read fails or throws", async () => {
		const read = vi.fn(async () => ({
			ok: true as const,
			value: held(TOTAL, TOTAL),
		}));
		const noWallet = { ...depsWith(read), firmWallet: () => null };
		expect(await draftAutopay(noWallet, DRAFT)).toBe(AutopayStatus.Unknown);
		expect(read).not.toHaveBeenCalled();

		const failed = depsWith(async () => ({ ok: false, error: "rpc down" }));
		expect(await draftAutopay(failed, DRAFT)).toBe(AutopayStatus.Unknown);

		const thrown = depsWith(async () => {
			throw new Error("socket hang up");
		});
		expect(await draftAutopay(thrown, DRAFT)).toBe(AutopayStatus.Unknown);
	});

	test("unknown when the chain does not answer within 2 s", async () => {
		const read = deferred<ChainRead<FirmTokenAccount>>();
		const deadline = deferred<undefined>();
		const sleeps: { millis: number; signal: AbortSignal }[] = [];
		const deps = depsWith(
			() => read.promise,
			(millis, signal) => {
				sleeps.push({ millis, signal });
				return deadline.promise;
			},
		);

		const status = draftAutopay(deps, DRAFT);
		deadline.resolve(undefined);
		expect(await status).toBe(AutopayStatus.Unknown);
		expect(sleeps.map((entry) => entry.millis)).toEqual([2000]);
		expect(sleeps[0]?.signal.aborted).toBe(true);

		read.resolve({ ok: true, value: held(TOTAL, TOTAL) });
		expect(await status).toBe(AutopayStatus.Unknown);
	});
});

describe("draft creation with an unknown snapshot", () => {
	test("draft creation still answers 201 when the chain read throws", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		gateway.chain.answer.tokenAccount = async () => {
			throw new Error("socket hang up");
		};

		const draft = await createDraft(gateway.app, firm.mcpToken);
		expect(draft.autopay).toBe("unknown");

		const draftId = textField(draft, "draftId");
		const read = await send(gateway.app, "GET", `/api/orders/draft/${draftId}`);
		expect((await expectJson(read, 200)).state).toBe("draft");
		const reads = gateway.chain.calls.map((call) => call.method);
		expect(reads).toEqual(["tokenAccount"]);
	});
});
