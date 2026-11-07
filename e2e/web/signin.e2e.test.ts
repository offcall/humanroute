// Sign-in from a tab without Phantom through the approve page (ADR 0034). Two
// isolated contexts in one Chromium: the provider-free tab owns the login request, the context
// with Phantom only approves it.
import { Keypair } from "@solana/web3.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { e2eEnv } from "../support/env.js";
import { registerFirm } from "../support/people.js";
import { openBrowser, type Session } from "./browser.js";
import { captureFailures } from "./capture.js";
import { PhantomCall } from "./phantom.js";

describe("sign-in via approve", () => {
	let session: Session;

	beforeAll(async () => {
		session = await openBrowser("e2e/web/signin");
	});
	afterAll(async () => {
		await session?.close();
	});
	captureFailures(() => session);

	test("signs in from a tab without Phantom through the approve page", async () => {
		const key = Keypair.generate();
		await registerFirm(e2eEnv().gatewayUrl, key);
		const waiting = await session.role(null);
		const approver = await session.role(key);

		await waiting.page.goto("/firm");
		const link = waiting.page.getByRole("link", {
			name: "Sign in with Phantom",
		});
		await link.waitFor({ timeout: 20_000 });
		const deepLink = (await link.getAttribute("href")) ?? "";
		const target = decodeURIComponent(
			/^https:\/\/phantom\.app\/ul\/browse\/([^?]+)/.exec(deepLink)?.[1] ?? "",
		);
		expect(new URL(target).pathname).toMatch(/^\/approve\/[^/]+$/);

		await approver.page.goto(target);
		await approver.page.getByRole("button", { name: "Approve" }).click();
		await approver.page.getByText("Done, go back to Safari").first().waitFor();
		expect(approver.phantom?.calls).toContain(PhantomCall.Message);

		await waiting.page
			.getByText("E2E firm · Jobs")
			.waitFor({ timeout: 20_000 });
		const waitingMe = await waiting.page.evaluate(
			async () => (await fetch("/api/me")).status,
		);
		expect(waitingMe).toBe(200);
		const approverMe = await approver.page.evaluate(
			async () => (await fetch("/api/me")).status,
		);
		expect(approverMe).toBe(401);
		const cookies = await approver.context.cookies();
		expect(cookies.filter((cookie) => cookie.name === "hr_session")).toEqual(
			[],
		);
		expect(session.blocked).toEqual([]);
	});
});
