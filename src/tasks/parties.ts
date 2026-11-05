// Who ordered and who executes a task (ADR 0033): firm name, claimer's agency and translator number.
import type { Task } from "./types.js";

type Named = { id: string; name: string };

// Account lookups provided by accounts through wiring; tasks and orders both need them.
export type PartyPorts = {
	firmById: (firmId: string) => Named | null;
	agencyById: (agencyId: string) => Named | null;
	translatorNo: (linguistId: string) => number | null;
};

export type TaskParties = {
	firmName: string;
	agency: Named | null;
	translatorNo: number | null;
};

// A task always belongs to an existing firm; a missing one is a bug.
export const firmNameOf = (ports: PartyPorts, task: Task): string => {
	const firm = ports.firmById(task.firmId);
	if (firm === null) {
		throw new Error(`firm of task ${task.id} not found`);
	}
	return firm.name;
};

const agencyOf = (ports: PartyPorts, task: Task): Named | null => {
	const agency =
		task.agencyId === null ? null : ports.agencyById(task.agencyId);
	return agency === null ? null : { id: agency.id, name: agency.name };
};

export const partiesOf = (ports: PartyPorts, task: Task): TaskParties => ({
	firmName: firmNameOf(ports, task),
	agency: agencyOf(ports, task),
	translatorNo:
		task.linguistId === null ? null : ports.translatorNo(task.linguistId),
});
