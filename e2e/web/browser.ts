// One headless Chromium per browser test file, under the host lock, with one context per role.
// Every context: devnet RPC (the browser x402 client has no rpcUrl, finding 7) is answered by the
// environment's RPC; any other non-loopback request is aborted and recorded, and the test fails.
// Chromium itself gets a dead proxy, so even its own background traffic cannot leave the host.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Keypair } from "@solana/web3.js";
import {
	type Browser,
	type BrowserContext,
	chromium,
	type Page,
} from "playwright";
import { isLoopback } from "../env/egress.js";
import { e2eEnv } from "../support/env.js";
import type { Jar } from "../support/http.js";
import { takeChromiumLock } from "./lock.js";
import { installPhantom, type Phantom } from "./phantom.js";

const DEVNET_RPC_HOST = "api.devnet.solana.com";
const LOCK_WAIT_MS = 10 * 60_000;
const WEB_DIST = join(import.meta.dirname, "../../web/dist/index.html");

export type Role = {
	context: BrowserContext;
	page: Page;
	phantom: Phantom | null;
};

export type Session = {
	role: (key: Keypair | null) => Promise<Role>;
	// Screenshot and text of every open page into the run's log dir (kept with E2E_KEEP_LOGS=1).
	capture: (name: string) => Promise<void>;
	// Non-loopback URLs a page tried to load; each test expects none.
	blocked: string[];
	close: () => Promise<void>;
};

const routeContext = async (
	context: BrowserContext,
	blocked: string[],
): Promise<void> => {
	const rpcUrl = e2eEnv().rpcUrl;
	await context.route("**/*", async (route) => {
		const url = new URL(route.request().url());
		if (isLoopback(url.hostname)) {
			await route.continue();
			return;
		}
		if (url.hostname === DEVNET_RPC_HOST) {
			const response = await route.fetch({ url: rpcUrl });
			await route.fulfill({ response });
			return;
		}
		blocked.push(url.href);
		await route.abort("blockedbyclient");
	});
};

export const openBrowser = async (owner: string): Promise<Session> => {
	if (!existsSync(WEB_DIST)) {
		throw new Error(
			"web/dist is missing: run npm run build once before the browser e2e",
		);
	}
	const lock = await takeChromiumLock(owner, LOCK_WAIT_MS);
	let browser: Browser;
	try {
		browser = await chromium.launch({
			headless: true,
			args: [
				"--proxy-server=http://127.0.0.1:9",
				"--disable-background-networking",
				"--disable-component-update",
				"--no-first-run",
			],
		});
	} catch (error) {
		lock.release();
		throw error;
	}
	const blocked: string[] = [];
	const contexts: BrowserContext[] = [];

	const role = async (key: Keypair | null): Promise<Role> => {
		const context = await browser.newContext({
			baseURL: e2eEnv().gatewayUrl,
			serviceWorkers: "block",
			viewport: { width: 1280, height: 900 },
		});
		contexts.push(context);
		await routeContext(context, blocked);
		const phantom = key === null ? null : await installPhantom(context, key);
		return { context, page: await context.newPage(), phantom };
	};

	const capture = async (name: string): Promise<void> => {
		const pages = contexts.flatMap((context) => context.pages());
		for (const [index, page] of pages.entries()) {
			const base = join(
				e2eEnv().logDir,
				`${name.replace(/\W+/g, "-")}-${index}`,
			);
			await page
				.screenshot({ path: `${base}.png`, fullPage: true })
				.catch(() => undefined);
			const text = await page
				.locator("body")
				.innerText()
				.catch(() => "");
			writeFileSync(`${base}.txt`, `${page.url()}\n\n${text}`);
		}
	};

	return {
		role,
		capture,
		blocked,
		close: async () => {
			try {
				for (const context of contexts) {
					await context.close().catch(() => undefined);
				}
				await browser.close();
			} finally {
				lock.release();
			}
		},
	};
};

// Signs the context in with an API session (SIWS done in Node), for cases that test a cabinet,
// not the sign-in itself.
export const useSession = async (role: Role, jar: Jar): Promise<void> => {
	const url = e2eEnv().gatewayUrl;
	await role.context.addCookies(
		[...jar].map(([name, value]) => ({ name, value, url })),
	);
};
