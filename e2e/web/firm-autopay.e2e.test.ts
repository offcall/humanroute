// Auto-pay setup in the firm cabinet. Phantom signs and sends the v0 Approve and
// Revoke built by the page; the bridge sends them to the local RPC and returns {signature}.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupAgent } from "../support/agent.js";
import { tokenAccount } from "../support/autopay.js";
import { ataOf } from "../support/chain.js";
import { e2eEnv, firmKey, pollUntil } from "../support/env.js";
import { FirmSlot } from "../support/firms.js";
import { firmAt } from "../support/fixture.js";
import { call } from "../support/http.js";
import { openBrowser, type Session, useSession } from "./browser.js";
import { captureFailures } from "./capture.js";
import { PhantomCall } from "./phantom.js";

describe("firm auto-pay", () => {
	let session: Session;

	beforeAll(async () => {
		session = await openBrowser("e2e/web/firm-autopay");
	});
	afterAll(async () => {
		await session?.close();
	});
	captureFailures(() => session);

	test("auto-pay setup shows the command, approves the limit in Phantom, shows the allowance and Turn off revokes it", async () => {
		const env = e2eEnv();
		const firm = await firmAt(FirmSlot.BrowserAutopay);
		const wallet = firm.key.publicKey.toBase58();
		const role = await session.role(firmKey(FirmSlot.BrowserAutopay));
		await useSession(role, firm.jar);
		const { page, phantom } = role;
		const agent = await setupAgent(wallet);
		try {
			// No orders yet: the Jobs hero shows Connect Claude with the auto-pay row.
			await page.goto("/firm/jobs");
			await page.getByRole("button", { name: "Set up" }).click();
			const command =
				(await page.locator(".ap-card .codeblock pre").first().textContent()) ??
				"";
			expect(command).toContain(`curl -fsSL ${env.gatewayUrl}/agent/sign.mjs`);
			expect(command).toContain(`--source ${ataOf(wallet).toBase58()}`);
			expect(command).toContain(`--mint ${env.mint}`);
			await page.getByRole("button", { name: "I ran it →" }).click();

			await page.getByLabel("Agent public key").fill(agent.publicKey);
			await page.getByLabel("Limit").fill("2.5");
			await page.getByRole("button", { name: "Allow in Phantom" }).click();
			await page.getByText("Auto-pay by Claude").first().waitFor();
			await page.locator(".ap-badge--on").waitFor({ timeout: 20_000 });
			const account = await tokenAccount(wallet);
			expect(account.delegate?.toBase58()).toBe(agent.publicKey);
			expect(account.delegatedAmount).toBe(2_500_000n);
			const view = await call(env.gatewayUrl, "GET", "/api/firm/autopay", {
				jar: firm.jar,
			});
			expect(view.allowanceUnits).toBe("2500000");
			expect(
				phantom?.calls.filter((item) => item === PhantomCall.Send),
			).toHaveLength(1);

			// A different connected Phantom account: the page refuses before anything is sent.
			if (phantom) {
				phantom.connectAs = agent.publicKey;
			}
			await page.getByRole("button", { name: "Turn off" }).click();
			await page
				.getByText(`switch Phantom to your firm wallet ${wallet}`)
				.waitFor();
			expect(
				phantom?.calls.filter((item) => item === PhantomCall.Send),
			).toHaveLength(1);
			expect((await tokenAccount(wallet)).delegatedAmount).toBe(2_500_000n);

			if (phantom) {
				phantom.connectAs = null;
			}
			await page.getByRole("button", { name: "Turn off" }).click();
			await pollUntil(
				() => tokenAccount(wallet),
				(current) => current.delegate === null,
				20_000,
				"revoked",
			);
			await page
				.getByRole("button", { name: "Set up" })
				.waitFor({ timeout: 20_000 });
			expect(
				phantom?.calls.filter((item) => item === PhantomCall.Send),
			).toHaveLength(2);
			expect(session.blocked).toEqual([]);
		} finally {
			agent.remove();
		}
	});
});
