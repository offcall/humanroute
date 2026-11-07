// Browser NEW-23 (finding 1): the payment really settles on the local chain, then the page loses
// the answer. A forwarding gate (page.route) passes the paid POST to the gateway and drops the
// response, or replaces it with the gateway's orphan answer. The page must never offer a second
// payment. The orphan variant's 500 body is written by the gate, in the gateway's orphanBody shape.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usdcOf } from "../support/chain.js";
import { e2eEnv, firmKey } from "../support/env.js";
import { FirmSlot } from "../support/firms.js";
import { firmAt } from "../support/fixture.js";
import { call, isRecord } from "../support/http.js";
import { createDraft } from "../support/orders.js";
import { openBrowser, type Session } from "./browser.js";
import { captureFailures } from "./capture.js";
import { PhantomCall } from "./phantom.js";

enum Lost {
	Dropped = "response dropped after the order was recorded",
	Orphan = "orphan answer after settlement",
}

const TEXTS: Record<Lost, string> = {
	[Lost.Dropped]:
		"We do not know if your payment went through. Do not pay again: check its status.",
	[Lost.Orphan]: "Your payment settled, but no order was created.",
};

describe("pay page, unknown outcome", () => {
	let session: Session;

	beforeAll(async () => {
		session = await openBrowser("e2e/web/pay-unknown");
	});
	afterAll(async () => {
		await session?.close();
	});
	captureFailures(() => session);

	it.each([Lost.Dropped, Lost.Orphan])(
		"NEW-23 a lost response after settlement never exposes a second payment action (%s)",
		async (lost) => {
			const firm = await firmAt(FirmSlot.BrowserUnknown);
			const wallet = firm.key.publicKey.toBase58();
			const { page, phantom } = await session.role(
				firmKey(FirmSlot.BrowserUnknown),
			);
			const draft = await createDraft(firm.mcpToken, ["es"]);
			let settled: number | null = null;
			await page.route(`**/x/orders/${draft.draftId}`, async (route) => {
				if (route.request().headers()["payment-signature"] === undefined) {
					await route.continue();
					return;
				}
				const response = await route.fetch();
				settled = response.status();
				const body: unknown = await response.json().catch(() => ({}));
				if (lost === Lost.Dropped) {
					await route.abort("connectionreset");
					return;
				}
				const payTx = isRecord(body) ? body.payTx : undefined;
				await route.fulfill({
					status: 500,
					json: { error: "orphan_payment", payTx },
				});
			});
			const before = await usdcOf(wallet);

			await page.goto(`/pay/${draft.draftId}`);
			await page.getByRole("button", { name: "Pay with Phantom" }).click();
			await page.getByText(TEXTS[lost]).waitFor({ timeout: 60_000 });

			expect(settled).toBe(201);
			expect(
				await page.getByRole("button", { name: "Pay with Phantom" }).count(),
			).toBe(0);
			if (lost === Lost.Dropped) {
				// The order was recorded, so Check status turns the page into Already paid.
				await page.getByRole("button", { name: "Check status" }).click();
				await page.getByRole("heading", { name: "Already paid" }).waitFor();
				expect(
					await page.getByRole("button", { name: "Pay with Phantom" }).count(),
				).toBe(0);
			}
			const signs = phantom?.calls.filter(
				(item) => item === PhantomCall.Transaction,
			);
			expect(signs).toHaveLength(1);
			const status = await call(
				e2eEnv().gatewayUrl,
				"GET",
				`/api/orders/draft/${draft.draftId}`,
			);
			expect(status.state).toBe("paid");
			expect(await usdcOf(wallet)).toBe(before - draft.totalUnits);
			expect(session.blocked).toEqual([]);
		},
	);
});
