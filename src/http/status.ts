// GET /jobs/:id?token= -> JSON status; GET /jobs/:id/view?token= -> auto-refreshing HTML.
// The HMAC status token is the only auth; a missing job and a bad token both return 404.
import { Hono } from "hono";
import { statusTokenValid } from "../payments/index.js";
import type { Job } from "../store/index.js";
import { jobStatus } from "./jobStatus.js";
import { jobView } from "./jobView.js";
import type { StatusDeps } from "./types.js";

export const statusRoutes = (deps: StatusDeps): Hono => {
	const app = new Hono();
	const load = (jobId: string, token: string | undefined): Job | undefined => {
		const job = deps.store.jobs.get(jobId);
		return job && statusTokenValid(deps.statusSecret, job.id, token)
			? job
			: undefined;
	};

	app.get("/jobs/:id", (ctx) => {
		const job = load(ctx.req.param("id"), ctx.req.query("token"));
		if (!job) {
			return ctx.json({ error: "not found" }, 404);
		}
		return ctx.json(jobStatus(deps.store, job));
	});

	app.get("/jobs/:id/view", (ctx) => {
		const job = load(ctx.req.param("id"), ctx.req.query("token"));
		if (!job) {
			return ctx.text("not found", 404);
		}
		return ctx.html(jobView(job.id, jobStatus(deps.store, job), deps.now()));
	});

	return app;
};
