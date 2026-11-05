import { matchPath } from "../shared";

export enum Tab {
	Board = "board",
	Tasks = "tasks",
	Wallet = "wallet",
}

export const TAB_PATH: Record<Tab, string> = {
	[Tab.Board]: "/linguist",
	[Tab.Tasks]: "/linguist/tasks",
	[Tab.Wallet]: "/linguist/wallet",
};

export const TAB_TITLE: Record<Tab, string> = {
	[Tab.Board]: "Board",
	[Tab.Tasks]: "My tasks",
	[Tab.Wallet]: "Wallet",
};

export type Screen = { tab: Tab; taskId: string | undefined };

// The linguist sub-route (ADR 0032); a task screen sits under My tasks.
export const screenOf = (path: string): Screen | undefined => {
	const taskId = matchPath("/linguist/tasks/:taskId", path)?.taskId;
	if (taskId !== undefined) {
		return { tab: Tab.Tasks, taskId };
	}
	for (const tab of Object.values(Tab)) {
		if (matchPath(TAB_PATH[tab], path)) {
			return { tab, taskId: undefined };
		}
	}

	return undefined;
};
