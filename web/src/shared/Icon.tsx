// Inline icons from the Indigo sprite (symbols.svg.html); always decorative.
export enum IconName {
	Alarm = "alarm",
	Arrow = "arrow",
	Check = "check",
	Chev = "chev",
	Clock = "clock",
	Copy = "copy",
	Ext = "ext",
	Plus = "plus",
	Refresh = "refresh",
	Undo = "undo",
	Cross = "x",
}

const PATHS: Record<IconName, string[]> = {
	[IconName.Alarm]: [
		"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
		"M12 7v6M12 16.5v.5",
	],
	[IconName.Arrow]: ["M3 12h17M14 6l6 6-6 6"],
	[IconName.Check]: ["M20 6 9 17l-5-5"],
	[IconName.Chev]: ["m9 6 6 6-6 6"],
	[IconName.Clock]: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18", "M12 7v5l3.5 2"],
	[IconName.Copy]: [
		"M11 8.5h7a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 8.5 18v-7A2.5 2.5 0 0 1 11 8.5",
		"M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3",
	],
	[IconName.Plus]: ["M12 5v14M5 12h14"],
	[IconName.Ext]: [
		"M14 4h6v6M20 4 10 14",
		"M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5",
	],
	[IconName.Refresh]: ["M20 12a8 8 0 1 1-2.3-5.7", "M20 4v5h-5"],
	[IconName.Undo]: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
	[IconName.Cross]: ["M6 6l12 12M18 6 6 18"],
};

type Props = { name: IconName; size?: number };

export const Icon = ({ name, size = 16 }: Props) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		{PATHS[name].map((path) => (
			<path key={path} d={path} />
		))}
	</svg>
);

// Busy spinner for pills (.spinner spins it; reduced motion stops it)
export const Spinner = () => (
	<svg
		className="spinner"
		viewBox="0 0 24 24"
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.6"
		strokeLinecap="round"
	>
		<circle cx="12" cy="12" r="9" opacity=".3" />
		<path d="M21 12a9 9 0 0 0-9-9" />
	</svg>
);
