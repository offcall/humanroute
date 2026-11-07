// Browser: the linguist board on the real gateway. The board shows every open task in the
// linguist's pairs, so these cases use a pair no other e2e case orders (en -> nl).

import { Keypair } from "@solana/web3.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { e2eEnv } from "../support/env.js";
import { FirmSlot } from "../support/firms.js";
import { firmAt, paidOrder, team } from "../support/fixture.js";
import { isRecord } from "../support/http.js";
import { joinLinguist, registerAgency } from "../support/people.js";
import { approve, claim, submit, waitConfirmed } from "../support/tasks.js";
import { openBrowser, type Session, useSession } from "./browser.js";
import { captureFailures } from "./capture.js";

const ONLY_PAIR = [{ source: "en", target: "nl" }];

describe("linguist board", () => {
	let session: Session;

	beforeAll(async () => {
		session = await openBrowser("e2e/web/linguist");
	});
	afterAll(async () => {
		await session?.close();
	});
	captureFailures(() => session);

	it("BR-11 a new job appears behind the new jobs banner and Claim opens the task with a countdown", async () => {
		const gateway = e2eEnv().gatewayUrl;
		const firm = await firmAt(FirmSlot.BrowserLinguist);
		const agency = await registerAgency(gateway);
		const linguist = await joinLinguist(gateway, agency, ONLY_PAIR);
		const first = await paidOrder(firm, ["nl"]);
		const role = await session.role(linguist.key);
		await useSession(role, linguist.jar);
		const { page } = role;
		const claims: { type: string; body: string }[] = [];
		page.on("request", (request) => {
			if (request.url().endsWith("/claim")) {
				claims.push({
					type: request.headers()["content-type"] ?? "",
					body: request.postData() ?? "",
				});
			}
		});

		await page.goto("/linguist");
		const claimButtons = page.getByRole("button", { name: /^Claim: / });
		await expect.poll(() => claimButtons.count(), { timeout: 15_000 }).toBe(1);
		const second = await paidOrder(firm, ["nl"]);
		const banner = page.getByRole("button", {
			name: "1 new job on the board. Show them",
		});
		await banner.waitFor({ timeout: 20_000 });
		expect(await claimButtons.count()).toBe(1);
		await banner.click();
		await expect
			.poll(() => page.locator(".more").getByRole("button").count())
			.toBe(1);

		await claimButtons.first().click();
		await page.waitForURL(/\/linguist\/tasks\/[0-9a-f-]{36}$/, {
			timeout: 20_000,
		});
		const taskId = page.url().split("/").at(-1) ?? "";
		expect([first.task("nl").taskId, second.task("nl").taskId]).toContain(
			taskId,
		);
		const timer = page.getByRole("timer");
		await timer.waitFor();
		expect(await timer.getAttribute("aria-label")).toMatch(/left to deliver$/);
		const shown = (await timer.textContent()) ?? "";
		expect(shown).toMatch(/\d/);
		expect(shown).not.toMatch(/^0+[:.]?0*$/);
		expect(claims).toHaveLength(1);
		expect(claims[0]?.body).toBe("{}");
		expect(claims[0]?.type).toContain("application/json");
		expect(session.blocked).toEqual([]);
	});

	it("BR-10 joins by invite: preview shows the agency, sign in, join and set pairs on the Wallet tab", async () => {
		const gateway = e2eEnv().gatewayUrl;
		const agency = await registerAgency(gateway);
		const { page } = await session.role(Keypair.generate());

		await page.goto(`/join/${agency.code}`);
		await page.getByText("E2E agency").first().waitFor();
		await page.getByRole("button", { name: "Sign in and join" }).click();
		await page.waitForURL("**/linguist", { timeout: 30_000 });

		await page.goto("/linguist/wallet");
		await page.getByLabel("From").selectOption("en");
		await page.getByLabel("To").selectOption("it");
		await page.getByRole("button", { name: "Add", exact: true }).click();
		await page
			.getByRole("button", { name: /^Remove / })
			.first()
			.waitFor();
		const me = await page.evaluate(async () =>
			(await fetch("/api/linguist")).json(),
		);
		const pairs = isRecord(me) && Array.isArray(me.pairs) ? me.pairs : [];
		expect(pairs).toContainEqual({ source: "en", target: "it" });
		expect(session.blocked).toEqual([]);
	});

	it("BR-13 My tasks shows PAID with the linguist's share after the payout confirms", async () => {
		const firm = await firmAt(FirmSlot.BrowserLinguist);
		const { linguist } = await team();
		const order = await paidOrder(firm, ["es"]);
		const taskId = order.task("es").taskId;
		await claim(linguist.jar, taskId);
		await submit(linguist.jar, taskId);
		await approve(firm.jar, taskId);
		await waitConfirmed(firm.jar, order.paid.orderId, taskId);
		const role = await session.role(linguist.key);
		await useSession(role, linguist.jar);
		const { page } = role;

		await page.goto("/linguist/tasks");
		const stamp = page.locator(".stamp--paid");
		await stamp.first().waitFor({ timeout: 20_000 });
		expect(await stamp.count()).toBe(1);
		const shown = (await stamp.first().textContent()) ?? "";
		expect(shown).toContain("+0.40 USDC");
		expect(shown).not.toContain("0.50");
		expect(session.blocked).toEqual([]);
	});
});
