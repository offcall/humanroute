// SIWS sign-in, sessions and logout (ADR 0020).
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { openStore } from "../store/index.js";
import {
	createTestGateway,
	expectJson,
	send,
	type TestGateway,
	type TestWallet,
	testClock,
	textField,
	WALLETS,
} from "../testing/index.js";
import { authSlice } from "./migrations.js";
import { authRoutes } from "./routes.js";

const DAY_MS = 86_400_000;

const nonceFor = async (gateway: TestGateway, wallet: TestWallet) => {
	const res = await send(gateway.app, "POST", "/api/auth/nonce", {
		body: { wallet: wallet.address },
	});
	const body = await expectJson(res, 200);
	return {
		nonce: textField(body, "nonce"),
		message: textField(body, "message"),
	};
};

const verify = (gateway: TestGateway, body: unknown) =>
	send(gateway.app, "POST", "/api/auth/verify", { body });

// A signed verify body for the wallet's own fresh nonce.
const signedProof = async (gateway: TestGateway, wallet: TestWallet) => {
	const { nonce, message } = await nonceFor(gateway, wallet);
	return { wallet: wallet.address, nonce, signature: wallet.signText(message) };
};

const sessionCookie = (res: Response): string => {
	const line = res.headers
		.getSetCookie()
		.find((cookie) => cookie.startsWith("hr_session="));
	if (line === undefined) {
		throw new Error("no session cookie");
	}
	return line;
};

const cookieValue = (line: string): string =>
	line.slice("hr_session=".length).split(";")[0] ?? "";

const signIn = async (gateway: TestGateway, wallet = WALLETS.firm) => {
	const res = await verify(gateway, await signedProof(gateway, wallet));
	await expectJson(res, 200);
	return `hr_session=${cookieValue(sessionCookie(res))}`;
};

const me = (gateway: TestGateway, cookie?: string) =>
	send(gateway.app, "GET", "/api/me", cookie === undefined ? {} : { cookie });

describe("SIWS sign-in", () => {
	test("the nonce returns the server-built SIWS text bound to the wallet with the PUBLIC_BASE_URL domain and no Chain ID line", async () => {
		const gateway = createTestGateway();
		const { nonce, message } = await nonceFor(gateway, WALLETS.firm);
		const lines = message.split("\n");

		expect(lines[0]).toBe(
			"humanroute.test wants you to sign in with your Solana account:",
		);
		expect(lines[1]).toBe(WALLETS.firm.address);
		expect(lines).toContain("URI: http://humanroute.test");
		expect(lines).toContain(`Nonce: ${nonce}`);
		expect(nonce).toMatch(/^[0-9a-f]{64}$/);
		expect(message).not.toContain("Chain ID");
	});

	test("verify starts a session cookie and /api/me returns the wallet", async () => {
		const gateway = createTestGateway();
		expect(gateway.config.sessionTtlSeconds).toBe(7 * 86_400);
		const res = await verify(gateway, await signedProof(gateway, WALLETS.firm));
		expect(await expectJson(res, 200)).toEqual({
			wallet: WALLETS.firm.address,
		});

		const line = sessionCookie(res);
		expect(line).toContain("HttpOnly");
		expect(line).toContain("SameSite=Lax");
		expect(line).toContain("Path=/");
		expect(line).toContain("Max-Age=604800");
		expect(line).not.toContain("Secure");
		const cookie = `hr_session=${cookieValue(line)}`;
		expect(await expectJson(await me(gateway, cookie), 200)).toMatchObject({
			wallet: WALLETS.firm.address,
		});

		const clock = testClock();
		const { database } = openStore(":memory:", clock.now, [authSlice]);
		const https = authRoutes({
			database,
			now: clock.now,
			publicBaseUrl: "https://humanroute.example",
			sessionTtlSeconds: 604_800,
			nonceTtlSeconds: 300,
		});
		const challenge = await expectJson(
			await send(https, "POST", "/api/auth/nonce", {
				body: { wallet: WALLETS.firm.address },
			}),
			200,
		);
		const secure = await send(https, "POST", "/api/auth/verify", {
			body: {
				wallet: WALLETS.firm.address,
				nonce: textField(challenge, "nonce"),
				signature: WALLETS.firm.signText(textField(challenge, "message")),
			},
		});
		expect(sessionCookie(secure)).toContain("Secure");
	});

	test("a nonce works once", async () => {
		const gateway = createTestGateway();
		const proof = await signedProof(gateway, WALLETS.firm);
		await expectJson(await verify(gateway, proof), 200);
		expect((await verify(gateway, proof)).status).toBe(401);

		const fresh = await signedProof(gateway, WALLETS.firm);
		const wrong = WALLETS.firm.signText("something else");
		expect((await verify(gateway, { ...fresh, signature: wrong })).status).toBe(
			401,
		);
		expect((await verify(gateway, fresh)).status).toBe(401);
	});

	test("a nonce issued to another wallet fails", async () => {
		const gateway = createTestGateway();
		const { nonce, message } = await nonceFor(gateway, WALLETS.firm);
		const body = {
			wallet: WALLETS.agency.address,
			nonce,
			signature: WALLETS.agency.signText(message),
		};
		expect((await verify(gateway, body)).status).toBe(401);
	});

	test("a nonce at its 300 s TTL fails", async () => {
		const gateway = createTestGateway();
		const ttlMs = gateway.config.nonceTtlSeconds * 1000;
		expect(ttlMs).toBe(300_000);

		const early = await signedProof(gateway, WALLETS.firm);
		gateway.clock.advance(ttlMs - 1);
		expect((await verify(gateway, early)).status).toBe(200);

		const late = await signedProof(gateway, WALLETS.firm);
		gateway.clock.advance(ttlMs);
		expect(await expectJson(await verify(gateway, late), 401)).toEqual({
			error: "unauthorized",
		});
	});

	test("a signature over other text or by another key fails", async () => {
		const gateway = createTestGateway();
		const { nonce, message } = await nonceFor(gateway, WALLETS.firm);
		const otherText = WALLETS.firm.signText(`${message} `);
		const otherKey = WALLETS.agency.signText(message);
		const wallet = WALLETS.firm.address;

		expect(
			(await verify(gateway, { wallet, nonce, signature: otherText })).status,
		).toBe(401);
		const second = await nonceFor(gateway, WALLETS.firm);
		const body = { wallet, nonce: second.nonce, signature: otherKey };
		expect((await verify(gateway, body)).status).toBe(401);
	});

	test("every verify failure is the same 401", async () => {
		const gateway = createTestGateway();
		const proof = await signedProof(gateway, WALLETS.firm);
		const raw = await gateway.app.request("/api/auth/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{not json",
		});
		const answers = [
			raw,
			await verify(gateway, { ...proof, wallet: "0OIl-not-base58" }),
			await verify(gateway, {
				...proof,
				signature: Buffer.alloc(63).toString("base64"),
			}),
		];
		for (const res of answers) {
			expect(await expectJson(res, 401)).toEqual({ error: "unauthorized" });
		}
		expect((await verify(gateway, proof)).status).toBe(200);
	});
});

describe("sessions", () => {
	test("a session ends after 7 days", async () => {
		const gateway = createTestGateway();
		const cookie = await signIn(gateway);
		gateway.clock.advance(7 * DAY_MS - 1);
		expect((await me(gateway, cookie)).status).toBe(200);
		gateway.clock.advance(1);
		expect((await me(gateway, cookie)).status).toBe(401);
	});

	test("logout deletes the session and clears the cookie; a second logout is fine", async () => {
		const gateway = createTestGateway();
		const cookie = await signIn(gateway);
		const logout = () =>
			send(gateway.app, "POST", "/api/auth/logout", { cookie, body: {} });

		const first = await logout();
		expect(first.status).toBe(204);
		expect(sessionCookie(first)).toMatch(/^hr_session=;.*Max-Age=0/);
		expect((await me(gateway, cookie)).status).toBe(401);
		expect((await logout()).status).toBe(204);
	});

	test("the session token is stored only as a sha256 hash", async () => {
		const gateway = createTestGateway();
		const token = (await signIn(gateway)).slice("hr_session=".length);
		const rows = gateway.database.prepare("SELECT * FROM sessions").all();
		const hash = createHash("sha256").update(token).digest("hex");

		expect(rows).toEqual([expect.objectContaining({ token_hash: hash })]);
		expect(JSON.stringify(rows)).not.toContain(token);
	});
});
