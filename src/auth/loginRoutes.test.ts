// Sign-in via approve in Phantom (ADR 0034): create, approve, reject, claim.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openStore } from "../store/index.js";
import {
	expectJson,
	send,
	testClock,
	textField,
	WALLETS,
} from "../testing/index.js";
import { authSlice } from "./migrations.js";
import { authRoutes } from "./routes.js";

const PATH = "/api/auth/login-request";
const TTL_MS = 120_000;

const login = (publicBaseUrl = "http://humanroute.test") => {
	const clock = testClock();
	const { database } = openStore(":memory:", clock.now, [authSlice]);
	const app = authRoutes({
		database,
		now: clock.now,
		publicBaseUrl,
		sessionTtlSeconds: 604_800,
		nonceTtlSeconds: 300,
	});
	return { app, clock, database };
};

type Ctx = ReturnType<typeof login>;

const cookieLine = (res: Response, name: string): string | undefined =>
	res.headers.getSetCookie().find((line) => line.startsWith(`${name}=`));

// Creates a request; returns its id, the hr_login Cookie header and the response.
const create = async (ctx: Ctx) => {
	const res = await send(ctx.app, "POST", PATH, { body: {} });
	const body = await expectJson(res, 201);
	const line = cookieLine(res, "hr_login") ?? "";
	const secret = line.slice("hr_login=".length).split(";")[0] ?? "";
	return {
		id: textField(body, "id"),
		cookie: `hr_login=${secret}`,
		secret,
		res,
		body,
	};
};

// A signed SIWS proof for a fresh nonce, as Phantom's browser sends it.
const proof = async (ctx: Ctx, wallet = WALLETS.linguist) => {
	const challenge = await expectJson(
		await send(ctx.app, "POST", "/api/auth/nonce", {
			body: { wallet: wallet.address },
		}),
		200,
	);
	return {
		wallet: wallet.address,
		nonce: textField(challenge, "nonce"),
		signature: wallet.signText(textField(challenge, "message")),
	};
};

const approve = (ctx: Ctx, id: string, body: unknown) =>
	send(ctx.app, "POST", `${PATH}/${id}/approve`, { body });

const reject = (ctx: Ctx, id: string) =>
	send(ctx.app, "POST", `${PATH}/${id}/reject`, { body: {} });

const claim = (ctx: Ctx, id: string, cookie?: string) =>
	send(ctx.app, "POST", `${PATH}/${id}/claim`, {
		body: {},
		...(cookie === undefined ? {} : { cookie }),
	});

const nonceUsed = (ctx: Ctx, nonce: string): unknown =>
	ctx.database
		.prepare("SELECT used_at FROM nonces WHERE nonce = ?")
		.pluck()
		.get(nonce);

describe("AU-20T sign-in via approve in Phantom (ADR 0034)", () => {
	it("AU-20 the login request sets a 120 s HttpOnly Lax cookie on the login path and stores only the hash", async () => {
		const ctx = login();
		const { id, secret, res, body } = await create(ctx);
		const line = cookieLine(res, "hr_login") ?? "";

		expect(line).toContain("Max-Age=120");
		expect(line).toContain("HttpOnly");
		expect(line).toContain("SameSite=Lax");
		expect(line).toContain(`Path=${PATH}`);
		expect(line).not.toContain("Secure");
		expect(body).toEqual({ id, expiresAt: ctx.clock.now() + TTL_MS });
		expect(JSON.stringify(body)).not.toContain(secret);
		const rows = ctx.database.prepare("SELECT * FROM login_requests").all();
		const hash = createHash("sha256").update(secret).digest("hex");
		expect(rows).toEqual([expect.objectContaining({ id, secret_hash: hash })]);
		expect(JSON.stringify(rows)).not.toContain(secret);

		const https = await create(login("https://humanroute.example"));
		expect(cookieLine(https.res, "hr_login")).toContain("Secure");
	});

	it("AU-21 AU-22 claim waits until approve, then signs in once and is gone", async () => {
		const ctx = login();
		const { id, cookie } = await create(ctx);
		const waiting = await claim(ctx, id, cookie);
		expect(await expectJson(waiting, 202)).toEqual({ status: "pending" });
		expect(cookieLine(waiting, "hr_session")).toBeUndefined();

		const approved = await approve(ctx, id, await proof(ctx));
		expect(await expectJson(approved, 200)).toEqual({});
		expect(cookieLine(approved, "hr_session")).toBeUndefined();

		const done = await claim(ctx, id, cookie);
		expect(await expectJson(done, 200)).toEqual({
			wallet: WALLETS.linguist.address,
		});
		expect(done.headers.get("cache-control")).toBe("no-store");
		expect(cookieLine(done, "hr_session")).toBeDefined();
		expect(cookieLine(done, "hr_login")).toMatch(/^hr_login=;.*Max-Age=0/);
		expect((await claim(ctx, id, cookie)).status).toBe(410);
	});

	it("AU-23 claim with another browser's secret or none answers 410", async () => {
		const ctx = login();
		const mine = await create(ctx);
		const other = await create(ctx);
		await expectJson(await approve(ctx, mine.id, await proof(ctx)), 200);

		expect((await claim(ctx, mine.id, other.cookie)).status).toBe(410);
		expect((await claim(ctx, mine.id)).status).toBe(410);
		expect((await claim(ctx, mine.id, mine.cookie)).status).toBe(200);
	});

	it("AU-24 approve with a bad SIWS proof answers 401 and the request stays pending", async () => {
		const ctx = login();
		const { id, cookie } = await create(ctx);
		const signed = await proof(ctx);
		const bad = { ...signed, signature: WALLETS.agency.signText("other") };

		const res = await approve(ctx, id, bad);
		expect(await expectJson(res, 401)).toEqual({ error: "unauthorized" });
		expect(cookieLine(res, "hr_session")).toBeUndefined();
		expect(nonceUsed(ctx, signed.nonce)).not.toBeNull();
		expect((await claim(ctx, id, cookie)).status).toBe(202);
	});

	it("AU-25 AU-27 approve again or after reject answers 409, a replayed proof 401, and expiry 410", async () => {
		const ctx = login();
		const first = await create(ctx);
		const signed = await proof(ctx);
		await expectJson(await approve(ctx, first.id, signed), 200);
		expect((await approve(ctx, first.id, await proof(ctx))).status).toBe(409);
		expect((await approve(ctx, first.id, signed)).status).toBe(401);

		const rejected = await create(ctx);
		expect((await reject(ctx, rejected.id)).status).toBe(204);
		expect((await approve(ctx, rejected.id, await proof(ctx))).status).toBe(
			409,
		);

		const expiring = await create(ctx);
		const fresh = await proof(ctx);
		ctx.clock.advance(TTL_MS);
		expect((await approve(ctx, expiring.id, fresh)).status).toBe(410);
		expect((await reject(ctx, expiring.id)).status).toBe(410);
		expect((await claim(ctx, expiring.id, expiring.cookie)).status).toBe(410);
	});

	it("AU-26 reject makes the waiting claim answer 410", async () => {
		const ctx = login();
		const { id, cookie } = await create(ctx);
		expect((await claim(ctx, id, cookie)).status).toBe(202);
		expect((await reject(ctx, id)).status).toBe(204);
		expect(await expectJson(await claim(ctx, id, cookie), 410)).toEqual({
			status: "gone",
		});
	});

	it("AU-28 an id that is not 32 hex characters answers 410 before the nonce is consumed", async () => {
		const ctx = login();
		const { id, cookie } = await create(ctx);
		const signed = await proof(ctx);

		for (const badId of ["xyz", `${id}0`, "g".repeat(32)]) {
			expect((await claim(ctx, badId, cookie)).status).toBe(410);
			expect((await reject(ctx, badId)).status).toBe(410);
			expect((await approve(ctx, badId, signed)).status).toBe(410);
		}
		expect(nonceUsed(ctx, signed.nonce)).toBeNull();
		expect((await approve(ctx, id, signed)).status).toBe(200);
	});
});
