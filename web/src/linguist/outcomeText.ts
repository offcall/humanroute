import {
	formatClock,
	formatUsdc,
	StampKind,
	type Status,
	TagKind,
	type Task,
	TaskState,
} from "../shared";

export type Outcome = {
	title: string;
	caption: string;
	// the status pill; paying out has none (the title says it)
	tag: boolean;
	stamp: { kind: StampKind; note: string } | undefined;
};

const NO_PAY = "no pay for this task";

const refundText = (task: Task, done: boolean): Outcome => {
	const late = task.state === TaskState.ExpiredLate;
	const back = `${task.firmName} ${done ? "got" : "gets"} its ${formatUsdc(task.priceUnits)} back`;
	const stamp =
		late && done
			? { kind: StampKind.Late, note: "client refunded" }
			: undefined;
	if (!late) {
		const reason = task.reason === null ? "" : `: ${task.reason}`;
		const caption = `${task.firmName} rejected the translation${reason} · ${NO_PAY}`;
		return { title: "Rejected", caption, tag: true, stamp };
	}
	const due =
		task.workDeadline === null ? "" : ` by ${formatClock(task.workDeadline)}`;

	return {
		title: "Too late",
		caption: `Not delivered${due} · ${back} · ${NO_PAY}`,
		tag: true,
		stamp,
	};
};

// The big status word and its caption on the task screen once the work is handed in.
export const outcomeText = (
	task: Task,
	status: Status,
	todayUnits: bigint,
): Outcome => {
	const earned = task.transfer?.earnedUnits ?? null;
	const confirmedAt = task.transfer?.confirmedAt ?? null;
	switch (status.tagKind) {
		case TagKind.Paying: {
			const share =
				earned === null
					? ""
					: ` · you get ${formatUsdc(earned)} once the transfer is confirmed`;
			return {
				title: "Paying out",
				caption: `${task.firmName} approved${share}`,
				tag: false,
				stamp: undefined,
			};
		}
		case TagKind.Paid: {
			const when =
				confirmedAt === null
					? "Confirmed"
					: `Confirmed at ${formatClock(confirmedAt)}`;
			return {
				title: "Paid out",
				caption: `${when} · Today +${formatUsdc(todayUnits)}`,
				tag: true,
				stamp:
					earned === null
						? undefined
						: { kind: StampKind.Paid, note: `+${formatUsdc(earned)}` },
			};
		}
		case TagKind.Refunding:
		case TagKind.Refunded:
			return refundText(task, status.tagKind === TagKind.Refunded);
		default:
			return {
				title: "In review",
				caption: `Delivered · waiting for ${task.firmName} to review`,
				tag: true,
				stamp: undefined,
			};
	}
};
