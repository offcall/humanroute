import { IconName } from "../shared";

// What the page offers after a failed payment, read from the raw pay.ts message.
export enum Next {
	Retry = "retry",
	Reload = "reload",
	FirmCabinet = "firm-cabinet",
	CopyDraft = "copy-draft",
	CheckStatus = "check-status",
}

export type Failure = {
	title: string;
	icon: IconName;
	info: boolean;
	next: Next;
};

const fail = (title: string, icon: IconName, next = Next.Retry): Failure => ({
	title,
	icon,
	info: false,
	next,
});

export const failureOf = (message: string): Failure => {
	if (message.startsWith("payment settled, but")) {
		return {
			title: "Your payment went through, but we could not read the order.",
			icon: IconName.Refresh,
			info: true,
			next: Next.Reload,
		};
	}
	if (message.startsWith("payment settled but was not recorded")) {
		const title = "Your payment settled, but no order was created.";
		return fail(title, IconName.Alarm, Next.CopyDraft);
	}
	if (message === "this draft was already paid with another payment") {
		const title = "This draft is already paid. Your payment was not used.";
		return fail(title, IconName.Alarm, Next.FirmCabinet);
	}
	// Signed and sent, no definitive answer: it may have settled, so never offer Pay again.
	if (
		message.startsWith("payment aborted:") ||
		message.startsWith("payment outcome unknown")
	) {
		const title =
			"We do not know if your payment went through. Do not pay again: check its status.";
		return fail(title, IconName.Alarm, Next.CheckStatus);
	}
	if (message === "wallet connection was rejected") {
		return fail("Phantom did not connect. Nothing was paid.", IconName.Cross);
	}
	if (
		message.includes("Phantom rejected signing") &&
		message.includes("4001")
	) {
		return fail("You cancelled in Phantom. Nothing was paid.", IconName.Cross);
	}
	if (message.startsWith("payment failed (HTTP 402)")) {
		const title =
			"Payment did not go through. No USDC left your wallet; you can try again.";
		return fail(title, IconName.Alarm);
	}

	return fail(
		"The payment did not finish. Try again in a moment.",
		IconName.Refresh,
	);
};
