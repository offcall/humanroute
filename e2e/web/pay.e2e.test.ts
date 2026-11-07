// Browser: the pay page with a fake Phantom over the real gateway and the local chain.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { txFacts, usdcOf } from "../support/chain.js";
import { e2eEnv, firmKey } from "../support/env.js";
import { FirmSlot } from "../support/firms.js";
import { firmAt } from "../support/fixture.js";
import { call, text } from "../support/http.js";
import { createDraft } from "../support/orders.js";
import type { Firm } from "../support/people.js";
import { openBrowser, type Session } from "./browser.js";
import { captureFailures } from "./capture.js";
import { PhantomCall } from "./phantom.js";

const PAY_BUTTON = { name: "Pay with Phantom" };

describe("pay page", () => {
	let session: Session;
	let firm: Firm;

	beforeAll(async () => {
		session = await openBrowser("e2e/web/pay");
		firm = await firmAt(FirmSlot.BrowserPay);
	});
	afterAll(async () => {
		await session?.close();
	});
	captureFailures(() => session);

	test("the pay page shows the total and one row per language, pays with Phantom and shows Paid and IN ESCROW with the explorer link", async () => {
		const env = e2eEnv();
		const { page } = await session.role(firmKey(FirmSlot.BrowserPay));
		const draft = await createDraft(firm.mcpToken, ["es", "fr", "de"]);
		const wallet = firm.key.publicKey.toBase58();
		const before = await usdcOf(wallet);

		await page.goto(`/pay/${draft.draftId}`);
		await expect
			.poll(() => page.locator(".pay__total .num-money").textContent())
			.toBe("1.50");
		const rows = page.locator("ol.pay-lines > li:not(.pay-lines__sum)");
		await expect.poll(() => rows.count()).toBe(3);
		expect(await page.getByText("refunded to your firm's wallet").count()).toBe(
			1,
		);
		await page.getByRole("button", PAY_BUTTON).click();

		await page.locator("h1.pay-done__word").waitFor({ timeout: 60_000 });
		expect(await page.locator("h1.pay-done__word").textContent()).toContain(
			"Paid",
		);
		expect(await page.locator(".stamp--escrow").textContent()).toContain(
			"IN ESCROW",
		);
		const status = await call(
			env.gatewayUrl,
			"GET",
			`/api/orders/draft/${draft.draftId}`,
		);
		const order = await call(
			env.gatewayUrl,
			"GET",
			`/api/orders/${text(status, "orderId")}`,
			{
				jar: firm.jar,
			},
		);
		const payTx = text(order, "payTx");
		const href = await page.locator("a.pay-explorer").getAttribute("href");
		expect(href).toBe(`https://explorer.solana.com/tx/${payTx}?cluster=devnet`);
		const facts = await txFacts(payTx);
		expect(facts.deltas.get(env.holdAddress)).toBe(draft.totalUnits);
		expect(await usdcOf(wallet)).toBe(before - draft.totalUnits);
		expect(session.blocked).toEqual([]);
	});

	test("a response dropped after settlement never exposes a second payment action", async () => {
		const { page, phantom } = await session.role(firmKey(FirmSlot.BrowserPay));
		const draft = await createDraft(firm.mcpToken, ["es"]);
		const wallet = firm.key.publicKey.toBase58();
		let settled: number | null = null;
		// Forwards the paid POST to the gateway, then drops its response.
		await page.route(`**/x/orders/${draft.draftId}`, async (route) => {
			if (route.request().headers()["payment-signature"] === undefined) {
				await route.continue();
				return;
			}
			settled = (await route.fetch()).status();
			await route.abort("connectionreset");
		});
		const before = await usdcOf(wallet);

		await page.goto(`/pay/${draft.draftId}`);
		await page.getByRole("button", PAY_BUTTON).click();
		await page
			.getByText(
				"We do not know if your payment went through. Do not pay again: check its status.",
			)
			.waitFor({ timeout: 60_000 });

		expect(settled).toBe(201);
		expect(await page.getByRole("button", PAY_BUTTON).count()).toBe(0);
		await page.getByRole("button", { name: "Check status" }).click();
		await page.getByRole("heading", { name: "Already paid" }).waitFor();
		expect(await page.getByRole("button", PAY_BUTTON).count()).toBe(0);
		expect(
			phantom?.calls.filter((item) => item === PhantomCall.Transaction),
		).toHaveLength(1);
		const status = await call(
			e2eEnv().gatewayUrl,
			"GET",
			`/api/orders/draft/${draft.draftId}`,
		);
		expect(status.state).toBe("paid");
		expect(await usdcOf(wallet)).toBe(before - draft.totalUnits);
		expect(session.blocked).toEqual([]);
	});
});
