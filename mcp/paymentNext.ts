import { AutopayStatus } from "./types.js";

export const WAIT_AFTER_PAYMENT =
	"Start wait_task only if none is running for this draft in this conversation; otherwise leave the running wait to report payment. Use the latest seen you have from post_task, get_task or wait_task; use seen: draft only if you have no newer seen. Write your message before starting a wait, then end your turn while it runs.";

export const afterDraft = (autopay: AutopayStatus): string => {
	const offer =
		autopay === AutopayStatus.Available
			? "If the user has not chosen to pay by link, ask whether you should pay the total with the agent key. Then immediately start wait_task with this seen, without waiting for the user's answer."
			: "Do not offer auto-pay: it is unavailable or could not be checked. Immediately start wait_task with this seen.";

	return [
		"First write the full Pay link URL above to the user verbatim, as a clickable link.",
		"If the user already instructed you to pay, call prepare_payment, run its sign command, then pay_task without asking again; on success follow its wait instructions.",
		`Otherwise: ${offer}`,
		"Never ask the user to tell you when payment is complete. End your turn while wait_task runs. If the user later requests auto-pay, use prepare_payment and pay_task without starting a second wait for this draft.",
	].join(" ");
};
