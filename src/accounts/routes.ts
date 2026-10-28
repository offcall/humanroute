import { Hono } from "hono";
import { agencyRoutes } from "./agencyRoutes.js";
import { firmRoutes } from "./firmRoutes.js";
import { linguistRoutes } from "./linguistRoutes.js";
import {
	findAgencyByWallet,
	findFirmByWallet,
	findLinguistByWallet,
} from "./lookups.js";
import { sessionWallet, unauthorized } from "./session.js";
import type { AccountsDeps } from "./types.js";

export const accountsRoutes = (deps: AccountsDeps): Hono => {
	const app = new Hono();

	app.get("/api/me", (ctx) => {
		const wallet = sessionWallet(deps, ctx);
		if (wallet === null) {
			return unauthorized(ctx);
		}

		const firm = findFirmByWallet(deps.database, wallet);
		const agency = findAgencyByWallet(deps.database, wallet);
		const link = findLinguistByWallet(deps.database, wallet);

		return ctx.json({
			wallet,
			...(firm === null ? {} : { firm: { id: firm.id, name: firm.name } }),
			...(agency === null
				? {}
				: { agency: { id: agency.id, name: agency.name } }),
			...(link === null
				? {}
				: { linguist: { id: link.linguistId, agencyId: link.agencyId } }),
		});
	});

	app.route("/", firmRoutes(deps));
	app.route("/", agencyRoutes(deps));
	app.route("/", linguistRoutes(deps));

	return app;
};
