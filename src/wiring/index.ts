// Composition: builds each slice's deps from one database and one chain client (ADR 0019).
// Slices only meet here; no slice imports another slice's internals.
import { accountsSlice } from "../accounts/index.js";
import { authSlice } from "../auth/index.js";
import type { AppDeps } from "../http/index.js";
import { ordersSlice } from "../orders/index.js";
import { payoutsSlice, type TaskPayoutDeps } from "../payouts/index.js";
import type { SliceDefinition } from "../store/index.js";
import { tasksSlice } from "../tasks/index.js";
import { ordersDeps } from "./orders.js";
import { payoutDeps } from "./payouts.js";
import { peopleDeps } from "./people.js";
import { ratingDeps } from "./rating.js";
import { tasksDeps } from "./tasks.js";
import type { WiringInput } from "./types.js";

export type { WiringInput } from "./types.js";

export const SLICES: SliceDefinition[] = [
	authSlice,
	accountsSlice,
	tasksSlice,
	payoutsSlice,
	ordersSlice,
];

export type Wired = { app: AppDeps; payouts: TaskPayoutDeps };

export const wire = (input: WiringInput): Wired => {
	const { config, database, now } = input;
	const people = peopleDeps(database, now);
	const payouts = payoutDeps(input);
	const app: AppDeps = {
		auth: {
			database,
			now,
			publicBaseUrl: config.publicBaseUrl,
			sessionTtlSeconds: config.sessionTtlSeconds,
			nonceTtlSeconds: config.nonceTtlSeconds,
		},
		accounts: {
			database,
			now,
			lookupSession: people.lookupSession,
			publicBaseUrl: config.publicBaseUrl,
			mcpPublicUrl: config.mcpPublicUrl,
		},
		orders: ordersDeps(input, people),
		tasks: tasksDeps(input, payouts, people),
		rating: ratingDeps(database),
		preflightProblems: input.preflightProblems,
		webDistDir: config.webDistDir,
	};
	return { app, payouts };
};
