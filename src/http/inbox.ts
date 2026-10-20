// Expert inbox behind a magic-link token (demo auth only). Opening the inbox sets viewed_at on the
// listed jobs. Answers are accepted only while paid and before the deadline, else 409.
import { timingSafeEqual } from "node:crypto";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import { answer } from "../jobs/index.js";
import { inboxPage } from "./inboxView.js";
import type { InboxDeps } from "./types.js";
import { message } from "./views.js";

const tokenOk = (given: string, expected: string): boolean => {
	const actual = Buffer.from(given);
	const wanted = Buffer.from(expected);
	return actual.length === wanted.length && timingSafeEqual(actual, wanted);
};

const isJson = (ctx: Context): boolean =>
	(ctx.req.header("content-type") ?? "").includes("application/json");

const readAnswer = async (ctx: Context): Promise<unknown> => {
	if (isJson(ctx)) {
		const raw: unknown = await ctx.req.json();
		return typeof raw === "object" && raw !== null && "answer" in raw
			? raw.answer
			: undefined;
	}
	return (await ctx.req.parseBody()).answer;
};

export const inboxRoutes = (deps: InboxDeps): Hono => {
	const app = new Hono();
	const auth: MiddlewareHandler = async (ctx, next) => {
		if (!tokenOk(ctx.req.param("token") ?? "", deps.inboxToken)) {
			return ctx.text("not found", 404);
		}
		await next();
	};
	app.use("/inbox/:token", auth);
	app.use("/inbox/:token/*", auth);

	app.get("/inbox/:token", (ctx) => {
		const now = deps.now();
		const jobs = deps.store.jobs.listOpen(now);
		for (const job of jobs) {
			deps.store.jobs.markViewed(job.id, now);
		}
		return ctx.html(inboxPage(ctx.req.param("token"), jobs, now));
	});

	app.post("/inbox/:token/jobs/:id/answer", async (ctx) => {
		const back = `/inbox/${encodeURIComponent(ctx.req.param("token"))}`;
		const json =
			isJson(ctx) ||
			(ctx.req.header("accept") ?? "").includes("application/json");
		let raw: unknown;
		try {
			raw = await readAnswer(ctx);
		} catch {
			return json
				? ctx.json({ error: "invalid body" }, 400)
				: ctx.html(message(back, "invalid body", false), 400);
		}
		const jobId = ctx.req.param("id");
		const res = answer(deps.store, jobId, raw, deps.now());
		if (!res.ok) {
			return json
				? ctx.json({ error: res.error }, res.status)
				: ctx.html(message(back, res.error, false), res.status);
		}
		if (json) {
			return ctx.json({ ok: true, jobId, state: "answered" });
		}
		return ctx.html(
			message(
				back,
				"Translation submitted. Payout follows once the worker releases it.",
				true,
			),
		);
	});

	return app;
};
