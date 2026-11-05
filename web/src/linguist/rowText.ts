import {
	formatUsdc,
	StampKind,
	type Status,
	statusOf,
	TagKind,
	type Task,
	TaskState,
	toMs,
} from "../shared";

// The linguist reads a firm's reject as "Rejected"; firm and agency views keep "Refunded".
export const linguistStatus = (task: Task): Status => {
	const status = statusOf(task.state, task.publicState);

	return task.state === TaskState.Rejected &&
		status.tagKind === TagKind.Refunded
		? { ...status, word: "Rejected" }
		: status;
};

export enum RowTime {
	None = "none",
	Clock = "clock",
	Date = "date",
}

// "10:02" today, "4 Nov" earlier; nothing before the transfer is confirmed
export const rowTime = (task: Task, time: RowTime): string | undefined => {
	const confirmedAt = task.transfer?.confirmedAt ?? null;
	if (confirmedAt === null || time === RowTime.None) {
		return undefined;
	}
	const date = new Date(toMs(confirmedAt));

	return time === RowTime.Clock
		? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
		: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export type RowStamp = { kind: StampKind; note: string; spoken: string };

// PAID with the linguist's share, LATE once the client got the money back
export const rowStamp = (task: Task): RowStamp | undefined => {
	const status = statusOf(task.state, task.publicState);
	const earned = task.transfer?.earnedUnits ?? null;
	if (status.tagKind === TagKind.Paid && earned !== null) {
		const money = formatUsdc(earned);
		return { kind: StampKind.Paid, note: `+${money}`, spoken: `paid ${money}` };
	}
	if (
		status.tagKind === TagKind.Refunded &&
		task.state === TaskState.ExpiredLate
	) {
		const note = "client refunded";
		return { kind: StampKind.Late, note, spoken: `late, ${note}` };
	}

	return undefined;
};
