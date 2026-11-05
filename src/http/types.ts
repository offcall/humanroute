import type { AccountsDeps } from "../accounts/index.js";
import type { AuthDeps } from "../auth/index.js";
import type { NotifyDeps } from "../notify/index.js";
import type { OrdersDeps } from "../orders/index.js";
import type { RatingDeps } from "../rating/index.js";
import type { TasksDeps } from "../tasks/index.js";

export type AppDeps = {
	auth: AuthDeps;
	accounts: AccountsDeps;
	orders: OrdersDeps;
	tasks: TasksDeps;
	rating: RatingDeps;
	notify: NotifyDeps;
	preflightProblems: () => string[];
	webDistDir: string;
};
