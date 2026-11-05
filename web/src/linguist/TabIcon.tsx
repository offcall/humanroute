// Tab bar icons from the Indigo sprite (i-board, i-tasks, i-wallet); decorative.
export enum TabIconName {
	Board = "board",
	Tasks = "tasks",
	Wallet = "wallet",
}

const PATHS: Record<TabIconName, string[]> = {
	[TabIconName.Board]: [
		"M6 4.5h12a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17V7A2.5 2.5 0 0 1 6 4.5",
		"M3.5 10h17",
	],
	[TabIconName.Tasks]: [
		"M9 6h11M9 12h11M9 18h11",
		"m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17",
	],
	[TabIconName.Wallet]: [
		"M5.5 6h13A2.5 2.5 0 0 1 21 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-8A2.5 2.5 0 0 1 5.5 6",
		"M16 12.5h2",
		"M5 6V5.5A1.5 1.5 0 0 1 6.5 4H17",
	],
};

export const TabIcon = ({ name }: { name: TabIconName }) => (
	<svg
		width={22}
		height={22}
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
