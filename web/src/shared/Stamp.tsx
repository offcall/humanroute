export enum StampKind {
	Paid = "paid",
	Late = "late",
}

type Props = {
	kind: StampKind;
	// small line: "+0.50 USDC", a time, or "client refunded"
	note: string;
	still?: boolean;
	large?: boolean;
};

const WORDS: Record<StampKind, string> = {
	[StampKind.Paid]: "PAID",
	[StampKind.Late]: "LATE",
};

// Round PAID / LATE stamp; still: no stamping animation (lists, reloads).
export const Stamp = ({ kind, note, still = false, large = false }: Props) => {
	const classes = ["stamp", `stamp--${kind}`];
	if (still) {
		classes.push("stamp--still");
	}
	if (large) {
		classes.push("stamp--lg");
	}

	return (
		<span className={classes.join(" ")}>
			<b>{WORDS[kind]}</b> <small>{note}</small>
		</span>
	);
};
