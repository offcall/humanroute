import type { DraftView, PayResult } from "./types";

// What the pay page shows; the payment code itself lives in pay.ts.
export enum Step {
	Loading = "loading",
	NotFound = "not-found",
	LoadError = "load-error",
	AlreadyPaid = "already-paid",
	Ready = "ready",
	Paying = "paying",
	Paid = "paid",
	Failed = "failed",
}

export type PageStatus =
	| { name: Step.Loading | Step.NotFound | Step.LoadError }
	| { name: Step.AlreadyPaid; orderId: string | undefined }
	| { name: Step.Ready | Step.Paying; draft: DraftView }
	| { name: Step.Paid; draft: DraftView; result: PayResult }
	| { name: Step.Failed; draft: DraftView; message: string; checked: boolean };
