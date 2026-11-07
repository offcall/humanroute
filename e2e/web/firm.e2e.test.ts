// Browser: the firm from the landing to Jobs, and Review with real payouts on the chain, the
// :rejected refund and the public ratings.
import { Keypair } from "@solana/web3.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { txFacts } from "../support/chain.js";
import { firmKey, gatewayUrl } from "../support/env.js";
import { FirmSlot } from "../support/firms.js";
import { firmAt, paidOrder, team } from "../support/fixture.js";
import { call } from "../support/http.js";
import { claim, submit, waitConfirmed } from "../support/tasks.js";
import { openBrowser, type Session, useSession } from "./browser.js";
import { captureFailures } from "./capture.js";

describe("firm cabinet", () => {
	let session: Session;

	beforeAll(async () => {
		session = await openBrowser("e2e/web/firm");
	});
	afterAll(async () => {
		await session?.close();
	});
	captureFailures(() => session);

	test("registers a firm from the landing and lands on Jobs with the Connect Claude block", async () => {
		const { page } = await session.role(Keypair.generate());
		await page.goto("/");
		await page.getByLabel("Firm name").fill("Browser Pharma");
		await page.getByRole("button", { name: "Register firm" }).click();

		await page.waitForURL("**/firm/jobs", { timeout: 30_000 });
		await page.getByText("No orders yet").waitFor();
		const command = page.locator(".mcp pre");
		await command.waitFor();
		expect(await command.textContent()).toMatch(
			/^claude mcp add --transport http humanroute http:\/\/127\.0\.0\.1:\d+\/mcp --header "Authorization: Bearer \S+"$/,
		);
		expect(await page.getByText("Browser Pharma").count()).toBeGreaterThan(0);
		expect(session.blocked).toEqual([]);
	});

	test("Review approves one translation and rejects another with a reason", async () => {
		const firm = await firmAt(FirmSlot.BrowserFirm);
		const { agency, linguist } = await team();
		const order = await paidOrder(firm, ["es", "fr"]);
		for (const lang of ["es", "fr"]) {
			await claim(linguist.jar, order.task(lang).taskId);
			await submit(linguist.jar, order.task(lang).taskId);
		}
		const role = await session.role(firmKey(FirmSlot.BrowserFirm));
		await useSession(role, firm.jar);
		const { page } = role;
		const decisions: { url: string; type: string; body: string }[] = [];
		page.on("request", (request) => {
			if (/\/api\/tasks\/[^/]+\/(approve|reject)$/.test(request.url())) {
				const type = request.headers()["content-type"] ?? "";
				decisions.push({
					url: request.url(),
					type,
					body: request.postData() ?? "",
				});
			}
		});

		await page.goto("/firm/review");
		await page.getByRole("button", { name: /^Approve & pay/ }).click();
		await page.getByRole("button", { name: "Reject…" }).waitFor();
		await page.getByRole("button", { name: "Reject…" }).click();
		await page.locator(".reject-sheet .chip").first().click();
		await page.getByRole("button", { name: /^Reject and refund/ }).click();
		await page.getByRole("heading", { name: "All reviewed" }).waitFor();

		const approveCall = decisions.find((item) => item.url.endsWith("/approve"));
		expect(approveCall).toMatchObject({ body: "{}" });
		expect(approveCall?.type).toContain("application/json");
		const decided = new Map(
			decisions.map((item) => [
				item.url.split("/").at(-2) ?? "",
				item.url.endsWith("/approve"),
			]),
		);
		const [approvedLang, rejectedLang] = decided.get(order.task("es").taskId)
			? ["es", "fr"]
			: ["fr", "es"];
		const approvedId = order.task(approvedLang).taskId;
		const rejectedId = order.task(rejectedLang).taskId;

		await page.goto(`/firm/jobs/${order.paid.orderId}/${approvedLang}`);
		const paidStamp = page.locator(".stamp--paid");
		const approved = await waitConfirmed(
			firm.jar,
			order.paid.orderId,
			approvedId,
		);
		await paidStamp.waitFor({ timeout: 20_000 });
		expect(await page.locator(".money").textContent()).toContain(
			"USDC paid out at",
		);
		expect(await page.locator(".money a.proof").getAttribute("href")).toBe(
			`https://explorer.solana.com/tx/${approved.transferTx}?cluster=devnet`,
		);

		await page.goto(`/firm/jobs/${order.paid.orderId}/${rejectedLang}`);
		const rejected = await waitConfirmed(
			firm.jar,
			order.paid.orderId,
			rejectedId,
		);
		await page.getByText("USDC refunded to you").waitFor({ timeout: 20_000 });
		expect(await page.locator(".stamp--paid").count()).toBe(0);
		expect(await page.locator(".money a.proof").getAttribute("href")).toBe(
			`https://explorer.solana.com/tx/${rejected.transferTx}?cluster=devnet`,
		);
		expect(rejected.reason).not.toBeNull();
		expect(
			await page.getByText(rejected.reason ?? "", { exact: false }).count(),
		).toBeGreaterThan(0);
		expect(rejected.memo).toBe(`hr:${rejectedId}:rejected`);
		const refund = await txFacts(rejected.transferTx ?? "");
		expect(refund.deltas.get(firm.key.publicKey.toBase58())).toBe(500_000n);
		expect(refund.memos).toContain(`hr:${rejectedId}:rejected`);

		const gateway = gatewayUrl();
		const outcomes = { approved: 1, rejected: 1 };
		const agencyPath = `/api/rating/agency/${agency.agencyId}`;
		const firmPath = `/api/rating/firm/${firm.firmId}`;
		expect(await call(gateway, "GET", agencyPath)).toMatchObject(outcomes);
		expect(await call(gateway, "GET", firmPath)).toMatchObject(outcomes);
		expect(session.blocked).toEqual([]);
	});
});
