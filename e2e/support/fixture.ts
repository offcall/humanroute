// Per-test fixtures: a registered firm on a funded wallet, an agency with one linguist for
// en->es/fr/de, and a paid order. Every e2e case builds its own (no dependency on another `test`).
import { firmKey, gatewayUrl } from "./env.js";
import { createDraft, type Draft, type Paid, payDraft } from "./orders.js";
import {
	type Agency,
	type Firm,
	joinLinguist,
	type Linguist,
	registerAgency,
	registerFirm,
} from "./people.js";
import { orderTasks, type TaskState, taskOf } from "./tasks.js";

export const LANGS = ["es", "fr", "de"];

export type Team = { agency: Agency; linguist: Linguist };

export type PaidOrder = {
	draft: Draft;
	paid: Paid;
	tasks: TaskState[];
	task: (lang: string) => TaskState;
};

export const firmAt = (index: number): Promise<Firm> =>
	registerFirm(gatewayUrl(), firmKey(index));

export const team = async (): Promise<Team> => {
	const gateway = gatewayUrl();
	const agency = await registerAgency(gateway);
	const pairs = LANGS.map((target) => ({ source: "en", target }));
	const linguist = await joinLinguist(gateway, agency, pairs);
	return { agency, linguist };
};

export const secondLinguist = (agency: Agency): Promise<Linguist> =>
	joinLinguist(
		gatewayUrl(),
		agency,
		LANGS.map((target) => ({ source: "en", target })),
	);

export const paidOrder = async (
	firm: Firm,
	langs: string[],
): Promise<PaidOrder> => {
	const draft = await createDraft(firm.mcpToken, langs);
	const paid = await payDraft(firm.key, draft);
	const tasks = await orderTasks(firm.jar, paid.orderId);
	return { draft, paid, tasks, task: (lang) => taskOf(tasks, lang) };
};
