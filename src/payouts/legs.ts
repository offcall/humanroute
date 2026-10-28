// Legs and memo of the one transfer of a decided task (ADR 0023, ADR 0024).
import { type Task, TaskState } from "../tasks/index.js";
import { type Leg, LegRole, type Shares } from "./taskTypes.js";

const BPS_TOTAL = 10_000n;

// Agency and fee are exact bps shares; the linguist gets the rest. 0-unit legs are skipped.
export const splitLegs = (task: Task, shares: Shares): Leg[] => {
	const { linguistWallet, agencyWallet, priceUnits } = task;
	if (linguistWallet === null || agencyWallet === null) {
		throw new Error(`task ${task.id} has no payee snapshot`);
	}
	const agency = (priceUnits * shares.agencyBps) / BPS_TOTAL;
	const fee = (priceUnits * shares.feeBps) / BPS_TOTAL;
	const legs: Leg[] = [
		{
			role: LegRole.Linguist,
			wallet: linguistWallet,
			units: priceUnits - agency - fee,
		},
		{ role: LegRole.Agency, wallet: agencyWallet, units: agency },
		{ role: LegRole.Fee, wallet: shares.feeWallet, units: fee },
	];
	return legs.filter((leg) => leg.units > 0n);
};

export const refundLegs = (task: Task): Leg[] => [
	{ role: LegRole.Refund, wallet: task.refundWallet, units: task.priceUnits },
];

const MEMO_SUFFIX: Partial<Record<TaskState, string>> = {
	[TaskState.Approved]: "",
	[TaskState.Rejected]: ":rejected",
	[TaskState.ExpiredUnclaimed]: ":unclaimed",
	[TaskState.ExpiredLate]: ":late",
};

export const memoFor = (taskId: string, state: TaskState): string => {
	const suffix = MEMO_SUFFIX[state];
	if (suffix === undefined) {
		throw new Error(`task ${taskId} in state ${state} has no transfer`);
	}
	return `hr:${taskId}${suffix}`;
};
