// Named checks over the final task states, on-chain facts and ratings, plus the summary table.
import type { Connection } from "@solana/web3.js";
import { txFacts } from "./chain.js";
import { type Body, call, numberField } from "./http.js";
import type { TaskState } from "./tasks.js";

export type Check = { name: string; ok: boolean; detail: string };

export type Parties = {
	agent: string;
	linguist: string;
	agency: string;
	fee: string;
};

const PRICE = 500_000n;
const LINGUIST_UNITS = 400_000n;
const AGENCY_UNITS = 90_000n;
const FEE_UNITS = 10_000n;

export const explorer = (signature: string): string =>
	`https://explorer.solana.com/tx/${signature}?cluster=devnet`;

const check = (name: string, ok: boolean, detail: string): Check => ({
	name,
	ok,
	detail,
});

const transferChecks = async (
	connection: Connection,
	mint: string,
	label: string,
	task: TaskState,
	suffix: string,
	expected: [string, bigint][],
): Promise<Check[]> => {
	if (task.transferTx === null) {
		return [check(`${label} transfer`, false, "no transfer tx")];
	}
	const facts = await txFacts(connection, task.transferTx, mint);
	const memo =
		suffix === "" ? `hr:${task.taskId}` : `hr:${task.taskId}${suffix}`;
	const result = [
		check(
			`${label} memo`,
			facts.memos.includes(memo) && task.memo === memo,
			memo,
		),
	];
	for (const [owner, units] of expected) {
		const got = facts.deltas.get(owner) ?? 0n;
		result.push(
			check(`${label} +${units} to ${owner}`, got === units, `got ${got}`),
		);
	}
	return result;
};

export const chainChecks = async (
	connection: Connection,
	mint: string,
	parties: Parties,
	tasks: Map<string, TaskState>,
	orderPayTx: string,
): Promise<Check[]> => {
	const es = tasks.get("es");
	const fr = tasks.get("fr");
	const de = tasks.get("de");
	if (!es || !fr || !de) {
		return [check("tasks es, fr, de present", false, "missing task")];
	}
	const order = await txFacts(connection, orderPayTx, mint);
	return [
		check("order payment confirmed", order.deltas.size > 0, orderPayTx),
		check("es paid_out", es.publicState === "paid_out", es.publicState),
		check("fr refunded", fr.publicState === "refunded", fr.publicState),
		check("de refunded", de.publicState === "refunded", de.publicState),
		...(await transferChecks(connection, mint, "es", es, "", [
			[parties.linguist, LINGUIST_UNITS],
			[parties.agency, AGENCY_UNITS],
			[parties.fee, FEE_UNITS],
		])),
		...(await transferChecks(connection, mint, "fr", fr, ":rejected", [
			[parties.agent, PRICE],
		])),
		...(await transferChecks(connection, mint, "de", de, ":unclaimed", [
			[parties.agent, PRICE],
		])),
	];
};

const outcome = (body: Body, key: string): number => numberField(body, key);

export const ratingChecks = async (
	gateway: string,
	agencyId: string,
	firmId: string,
): Promise<Check[]> => {
	const agency = await call(
		gateway,
		"GET",
		`/api/rating/agency/${agencyId}`,
		"agency rating",
	);
	const firm = await call(
		gateway,
		"GET",
		`/api/rating/firm/${firmId}`,
		"firm rating",
	);
	return [
		check(
			"agency rating approved 1",
			outcome(agency, "approved") === 1,
			String(outcome(agency, "approved")),
		),
		check(
			"agency rating rejected 1",
			outcome(agency, "rejected") === 1,
			String(outcome(agency, "rejected")),
		),
		check(
			"firm rating approved 1",
			outcome(firm, "approved") === 1,
			String(outcome(firm, "approved")),
		),
		check(
			"firm rating rejected 1",
			outcome(firm, "rejected") === 1,
			String(outcome(firm, "rejected")),
		),
	];
};

export const printSummary = (
	orderPayTx: string,
	tasks: TaskState[],
	checks: Check[],
): void => {
	console.log(`\norder payment ${explorer(orderPayTx)}`);
	for (const task of tasks) {
		const link = task.transferTx === null ? "-" : explorer(task.transferTx);
		console.log(
			`${task.targetLang}  ${task.publicState}  ${task.memo ?? "-"}  ${link}`,
		);
	}
	for (const item of checks) {
		console.log(`${item.ok ? "ok  " : "FAIL"} ${item.name} (${item.detail})`);
	}
};
