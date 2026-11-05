type Props = {
	leftMs: number;
	// "to deliver", "to claim"
	subject: string;
};

const MARKS = [10, 30, 60];

const markOf = (leftMs: number): number | undefined =>
	leftMs > 0 ? MARKS.find((mark) => leftMs <= mark * 1000) : undefined;

// Polite live region for screen readers: the text changes only at 60, 30 and 10 s left.
export const Announcer = ({ leftMs, subject }: Props) => {
	const mark = markOf(leftMs);

	return (
		<p className="visually-hidden" aria-live="polite" aria-atomic="true">
			{mark === undefined ? "" : `${mark} seconds left ${subject}`}
		</p>
	);
};
