// Reject reason from the chips and the note: "Line missing; Wrong term — <note>". Pure.
export enum ReasonChip {
	Meaning = "Meaning changed",
	Missing = "Line missing",
	Term = "Wrong term",
}

export const REASON_CHIPS = Object.values(ReasonChip);

export const REASON_MAX = 1000;

// Chips keep their fixed order; the note is cut so the whole reason fits the API limit.
export const rejectReason = (chips: ReasonChip[], note: string): string => {
	const picked = REASON_CHIPS.filter((chip) => chips.includes(chip)).join("; ");
	const text = note.trim();
	if (picked === "") {
		return text.slice(0, REASON_MAX);
	}
	if (text === "") {
		return picked;
	}

	return `${picked} — ${text}`.slice(0, REASON_MAX);
};
