import { type Context, Hono } from "hono";
import { ratingPct, rejectPct } from "./percent.js";
import type { RatingDeps } from "./types.js";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const invalidId = (ctx: Context): Response =>
	ctx.json({ error: "invalid_id" }, 422);

// Public, no session (ADR 0025). Money: decimal strings of base units.
export const ratingRoutes = (deps: RatingDeps): Hono => {
	const app = new Hono();

	app.get("/api/rating/agency/:id", (ctx) => {
		const agencyId = ctx.req.param("id");
		if (!UUID_PATTERN.test(agencyId)) {
			return invalidId(ctx);
		}

		const outcomes = deps.outcomes.agencyOutcomes(agencyId);

		return ctx.json({
			agencyId,
			ratingPct: ratingPct(outcomes.approved, outcomes.rejected, outcomes.late),
			approved: outcomes.approved,
			rejected: outcomes.rejected,
			late: outcomes.late,
			paidUnits: outcomes.paidUnits.toString(),
		});
	});

	app.get("/api/rating/firm/:id", (ctx) => {
		const firmId = ctx.req.param("id");
		if (!UUID_PATTERN.test(firmId)) {
			return invalidId(ctx);
		}

		const outcomes = deps.outcomes.firmOutcomes(firmId);

		return ctx.json({
			firmId,
			rejectPct: rejectPct(outcomes.approved, outcomes.rejected),
			approved: outcomes.approved,
			rejected: outcomes.rejected,
			spentUnits: outcomes.spentUnits.toString(),
			refundedUnits: outcomes.refundedUnits.toString(),
		});
	});

	return app;
};
