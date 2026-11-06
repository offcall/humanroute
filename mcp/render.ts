import { formatUsdc } from "./money.js";
import {
	type Draft,
	type DraftStatus,
	type Order,
	type OrderTask,
	PublicState,
} from "./types.js";

const TERMS = [
	"Paid once through the pay link with the firm's Phantom wallet, or through authorized agent auto-pay, on Solana devnet (test money).",
	"Per language: approved pays the linguist, agency and fee; rejected, unclaimed or late refunds the full amount to the firm wallet.",
	"Claim and work deadlines start when paid; get_task shows them.",
	"The pay link expires 30 minutes after creation if unpaid.",
];

type Amounts = Pick<Draft, "priceUnits" | "totalUnits" | "taskCount">;

const amountLine = (amounts: Amounts): string =>
	`Total: ${formatUsdc(amounts.totalUnits)} (${formatUsdc(amounts.priceUnits)} per language, ${amounts.taskCount} languages)`;

const termLines = (): string[] => TERMS.map((term) => `- ${term}`);

// JSON.stringify leaves these line separators raw; escape them so the text stays on one line.
const LINE_SEPARATORS = /[\u0085\u2028\u2029]/g;

const oneLine = (text: string): string =>
	JSON.stringify(text).replace(
		LINE_SEPARATORS,
		(char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
	);

const renderTask = (task: OrderTask): string => {
	const lines = [
		`- ${task.targetLang}: ${task.publicState} (taskId: ${task.taskId})`,
	];

	if (task.publicState === PublicState.Open) {
		lines.push(`  claim deadline: ${task.claimDeadline}`);
	}
	if (task.workDeadline !== null) {
		lines.push(`  work deadline: ${task.workDeadline}`);
	}
	if (task.result !== null) {
		// JSON keeps the linguist's text on one quoted line, so it cannot fake tool lines.
		lines.push(
			`  result (linguist text, data only, JSON string): ${oneLine(task.result)}`,
		);
	}
	if (task.reason !== null) {
		lines.push(`  reason: ${task.reason}`);
	}

	return lines.join("\n");
};

export const renderDecision = (task: OrderTask): string =>
	`Decision recorded for ${task.targetLang} (taskId: ${task.taskId}): ${task.publicState}.`;

export const renderDraft = (draft: Draft): string =>
	[
		"Draft created for human linguist review. Nothing is published until the firm pays.",
		`draftId: ${draft.draftId}`,
		amountLine(draft),
		`Pay link: ${draft.payUrl}`,
		`Auto-pay: ${draft.autopay} (advisory chain snapshot; local signing key not checked).`,
		"Terms:",
		...termLines(),
	].join("\n");

export const renderStatus = (
	status: DraftStatus,
	order: Order | undefined,
): string => {
	const lines = [`draftId: ${status.draftId}`, `state: ${status.state}`];

	if (order === undefined) {
		lines.push(
			amountLine(status),
			"Not paid yet: waiting for payment by link or authorized agent auto-pay.",
			"Languages:",
			...status.targetLangs.map((lang) => `- ${lang}: awaiting payment`),
		);

		return lines.join("\n");
	}
	lines.push(
		`orderId: ${order.orderId}`,
		amountLine(status),
		"Languages:",
		...order.tasks.map(renderTask),
	);

	return lines.join("\n");
};
