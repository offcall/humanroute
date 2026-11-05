// Task status for tags and the 4-segment bar (brief §5, states.json). Pure.
import { TaskState } from "./types";

export enum TagKind {
	Open = "open",
	Claimed = "claimed",
	Submitted = "submitted",
	Paying = "paying",
	Paid = "paid",
	Refunding = "refunding",
	Refunded = "refunded",
}

// step: segments done (0..4) of Open, Claimed, Submitted, Paid out / Refunded.
// crossed: a refund; the steps after `step` were skipped and the last one is void.
export type Status = {
	word: string;
	tagKind: TagKind;
	step: number;
	crossed: boolean;
	final: boolean;
};

const WORDS: Record<TagKind, string> = {
	[TagKind.Open]: "Open",
	[TagKind.Claimed]: "Claimed",
	[TagKind.Submitted]: "Submitted",
	[TagKind.Paying]: "Paying out",
	[TagKind.Paid]: "Paid out",
	[TagKind.Refunding]: "Refunding",
	[TagKind.Refunded]: "Refunded",
};

const make = (tagKind: TagKind, step: number, crossed: boolean): Status => ({
	word: WORDS[tagKind],
	tagKind,
	step,
	crossed,
	final: tagKind === TagKind.Paid || tagKind === TagKind.Refunded,
});

// Steps a refunded task reached before it ended.
const reached = (state: TaskState): number => {
	switch (state) {
		case TaskState.Rejected:
			return 3;
		case TaskState.ExpiredLate:
			return 2;
		default:
			return 1;
	}
};

// publicState comes from the server; an unknown value falls back to the task state.
export const statusOf = (state: TaskState, publicState: string): Status => {
	switch (publicState) {
		case "paid_out":
			return make(TagKind.Paid, 4, false);
		case "paying_out":
			return make(TagKind.Paying, 3, false);
		case "refunded":
			return make(TagKind.Refunded, reached(state), true);
		case "refunding":
			return make(TagKind.Refunding, reached(state), true);
	}
	switch (state) {
		case TaskState.Open:
			return make(TagKind.Open, 0, false);
		case TaskState.Claimed:
			return make(TagKind.Claimed, 1, false);
		case TaskState.Submitted:
			return make(TagKind.Submitted, 2, false);
		case TaskState.Approved:
			return make(TagKind.Paying, 3, false);
		default:
			return make(TagKind.Refunding, reached(state), true);
	}
};
