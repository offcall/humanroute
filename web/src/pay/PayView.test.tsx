import { address } from "@solana/kit";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import { SOLANA_DEVNET_CAIP2 } from "@x402/svm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SessionProvider } from "../shared";
import { PayPage } from "./PayPage";
import { phantomError } from "./phantomError";

const DRAFT_ID = "draft_web01";
const PAYER = "Payer11111111111111111111111111111111111111";
const HOLD = "Hold1111111111111111111111111111111111111111";
const MINT = "Mint1111111111111111111111111111111111111111";
const TOTAL = "2000000";
const ORPHAN_TX = "OrphanTx1111111111111111111111111111111111111";

// The x402 scheme signs without Phantom or RPC; `cancel` makes it fail like a Phantom 4001.
const signing = vi.hoisted(() => ({ cancel: false }));

vi.mock("@x402/svm/exact/client", () => ({
	ExactSvmScheme: vi.fn(function scheme() {
		return {
			scheme: "exact",
			createPaymentPayload: async (x402Version: number) => {
				if (signing.cancel) {
					throw phantomError({ code: 4001, message: "User rejected" });
				}

				return { x402Version, payload: { transaction: "c2lnbmVk" } };
			},
		};
	}),
}));

vi.mock("./wallet", () => ({
	getPhantom: () => ({
		connect: async () => ({ publicKey: { toString: () => PAYER } }),
		signTransaction: async () => {
			throw new Error("not used: the scheme is faked");
		},
	}),
	connectPhantom: async () => ({
		ok: true,
		value: {
			address: PAYER,
			signer: { address: address(PAYER), signTransactions: async () => [] },
		},
	}),
}));

const draftBody = (state: string) => ({
	draftId: DRAFT_ID,
	state,
	sourceLang: "en",
	targetLangs: ["de", "fr"],
	taskCount: 2,
	priceUnits: "1000000",
	totalUnits: TOTAL,
	payTo: HOLD,
	mint: MINT,
	network: SOLANA_DEVNET_CAIP2,
	...(state === "paid" ? { orderId: "ord_1" } : {}),
	...(state === "orphaned" ? { payTx: ORPHAN_TX } : {}),
});

const json = (status: number, body: unknown): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const paymentRequired = (): Response => {
	const header = encodePaymentRequiredHeader({
		x402Version: 2,
		resource: { url: `/x/orders/${DRAFT_ID}`, description: "", mimeType: "" },
		accepts: [
			{
				scheme: "exact",
				network: SOLANA_DEVNET_CAIP2,
				asset: MINT,
				amount: TOTAL,
				payTo: HOLD,
				maxTimeoutSeconds: 60,
				extra: { feePayer: HOLD },
			},
		],
	});

	return new Response("{}", {
		status: 402,
		headers: { "PAYMENT-REQUIRED": header },
	});
};

type Gateway = { draftState: string; paid: () => Promise<Response> };

const pathOf = (input: RequestInfo | URL): string =>
	new URL(
		input instanceof Request ? input.url : String(input),
		"http://pay.test",
	).pathname;

const hasPayment = (input: RequestInfo | URL, init?: RequestInit): boolean =>
	input instanceof Request
		? input.headers.has("PAYMENT-SIGNATURE")
		: new Headers(init?.headers).has("PAYMENT-SIGNATURE");

// Node's Request rejects the page's relative URLs, which a browser resolves against the page.
class PageRequest extends Request {
	constructor(input: RequestInfo | URL, init?: RequestInit) {
		const url =
			typeof input === "string" ? new URL(input, window.location.href) : input;
		super(url, init);
	}
}

// Routes the page's requests: session, public draft read, unpaid probe, paid request.
const stubGateway = (gateway: Gateway): void => {
	vi.stubGlobal("Request", PageRequest);
	vi.stubGlobal(
		"fetch",
		async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const path = pathOf(input);
			if (path === `/api/orders/draft/${DRAFT_ID}`) {
				return json(200, draftBody(gateway.draftState));
			}
			if (path === `/x/orders/${DRAFT_ID}`) {
				return hasPayment(input, init) ? gateway.paid() : paymentRequired();
			}

			return json(401, { error: "unauthorized" });
		},
	);
};

const payButton = () =>
	screen.queryByRole("button", { name: /Pay with Phantom/ });

const payOnce = async (gateway: Gateway): Promise<void> => {
	stubGateway(gateway);
	render(
		<SessionProvider>
			<PayPage draftId={DRAFT_ID} />
		</SessionProvider>,
	);
	fireEvent.click(
		await screen.findByRole("button", { name: /Pay with Phantom/ }),
	);
	await waitFor(() => {
		expect(document.querySelector(".pay-raw")).not.toBeNull();
	});
};

const networkError = async (): Promise<Response> => {
	throw new TypeError("Failed to fetch");
};

beforeEach(() => {
	signing.cancel = false;
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("the pay page never offers Pay again after an unknown outcome", () => {
	test.each([
		["payment aborted after signing", networkError],
		["generic post-send 5xx", async () => json(500, { error: "internal" })],
		[
			"409 payment_in_progress",
			async () => json(409, { error: "payment_in_progress" }),
		],
	])(
		"%s: check status, and an unpaid public read keeps Pay hidden",
		async (_row, paid) => {
			const gateway = { draftState: "draft", paid };
			await payOnce(gateway);

			expect(payButton()).toBeNull();
			fireEvent.click(screen.getByRole("button", { name: "Check status" }));
			await screen.findByText(/No payment confirmed yet/);
			expect(payButton()).toBeNull();
		},
	);

	const openPage = (draftState: string): void => {
		stubGateway({ draftState, paid: networkError });
		render(
			<SessionProvider>
				<PayPage draftId={DRAFT_ID} />
			</SessionProvider>,
		);
	};

	test("a reload with an orphaned draft shows the orphan and no Pay button", async () => {
		openPage("orphaned");

		await screen.findByText(/Money was taken for this draft/);
		expect(payButton()).toBeNull();
		expect(screen.getByRole("button", { name: "Copy draft id" })).toBeTruthy();
		const proof = screen.getByRole("link", { name: /transaction/ });
		expect(proof.getAttribute("href")).toContain(ORPHAN_TX);
	});

	test("a reload with a settling draft shows no Pay button", async () => {
		openPage("settling");

		await screen.findByText(/is being settled. Do not pay again/);
		expect(payButton()).toBeNull();
		expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
	});

	test("a check that finds the draft orphaned shows the orphan", async () => {
		const gateway = { draftState: "draft", paid: networkError };
		await payOnce(gateway);
		gateway.draftState = "orphaned";

		fireEvent.click(screen.getByRole("button", { name: "Check status" }));

		await screen.findByText(/Money was taken for this draft/);
		expect(payButton()).toBeNull();
	});

	test("a check that finds the draft paid shows the paid state", async () => {
		const gateway = { draftState: "draft", paid: networkError };
		await payOnce(gateway);
		gateway.draftState = "paid";

		fireEvent.click(screen.getByRole("button", { name: "Check status" }));

		await screen.findByText("Nothing to pay here.");
		expect(payButton()).toBeNull();
	});

	// Known outcomes keep their own next step (reload, copy draft id, firm cabinet).
	test.each([
		["201 unreadable body", async () => json(201, { orderId: 7 }), "Reload"],
		[
			"orphan_payment",
			async () => json(502, { error: "orphan_payment" }),
			"Copy draft id",
		],
		["draft_paid", async () => json(409, { error: "draft_paid" }), "cabinet"],
	])("%s: no Pay button", async (_row, paid, next) => {
		await payOnce({ draftState: "draft", paid });

		expect(payButton()).toBeNull();
		expect(screen.getByText(new RegExp(next))).toBeTruthy();
	});

	test.each([
		["Phantom 4001 cancel", true, networkError],
		["402 refusal", false, async () => json(402, { error: "invalid_payment" })],
	])("%s still offers Pay again", async (_row, cancel, paid) => {
		signing.cancel = cancel;
		await payOnce({ draftState: "draft", paid });

		expect(payButton()).not.toBeNull();
		expect(screen.queryByRole("button", { name: "Check status" })).toBeNull();
	});
});
