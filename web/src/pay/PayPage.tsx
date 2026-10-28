import { useEffect, useState } from "react";
import { PaidView, ReadyView } from "./PayView";
import { parseDraftView } from "./parse";
import { payOrder } from "./pay";
import { DraftState, type DraftView, type PayResult } from "./types";
import { connectPhantom, getPhantom } from "./wallet";

type Status =
	| { name: "loading" }
	| { name: "ready"; draft: DraftView }
	| { name: "paying"; draft: DraftView }
	| { name: "paid"; result: PayResult }
	| { name: "error"; message: string; draft?: DraftView };

const loadDraft = async (draftId: string): Promise<Status> => {
	try {
		const response = await fetch(
			`/api/orders/draft/${encodeURIComponent(draftId)}`,
		);
		if (response.status === 404) {
			return { name: "error", message: "draft not found or expired" };
		}
		const parsed = parseDraftView(await response.json());
		if (!response.ok || !parsed.ok) {
			return { name: "error", message: "could not load the draft" };
		}

		if (parsed.value.state === DraftState.Paid) {
			return {
				name: "error",
				message: `this draft is already paid (order ${parsed.value.orderId ?? "unknown"})`,
			};
		}

		return { name: "ready", draft: parsed.value };
	} catch {
		return { name: "error", message: "could not load the draft" };
	}
};

export const PayPage = ({ draftId }: { draftId: string }) => {
	const [status, setStatus] = useState<Status>({ name: "loading" });
	const phantom = getPhantom();

	useEffect(() => {
		let active = true;
		void loadDraft(draftId).then((next) => {
			if (active) {
				setStatus(next);
			}
		});

		return () => {
			active = false;
		};
	}, [draftId]);

	const pay = async (draft: DraftView) => {
		if (phantom === undefined) {
			return;
		}
		setStatus({ name: "paying", draft });
		const wallet = await connectPhantom(phantom);
		if (!wallet.ok) {
			setStatus({ name: "error", message: wallet.error, draft });
			return;
		}
		const paid = await payOrder({
			draftId,
			totalUnits: draft.totalUnits,
			signer: wallet.value.signer,
		});
		setStatus(
			paid.ok
				? { name: "paid", result: paid.value }
				: { name: "error", message: paid.error, draft },
		);
	};

	if (status.name === "loading") {
		return <p>Loading draft...</p>;
	}
	if (status.name === "paid") {
		return <PaidView result={status.result} />;
	}
	const { draft } = status;

	return (
		<div>
			<h1>Pay for translation</h1>
			{status.name === "error" && <p role="alert">{status.message}</p>}
			{draft !== undefined && (
				<ReadyView
					draft={draft}
					installed={phantom !== undefined}
					paying={status.name === "paying"}
					onPay={() => void pay(draft)}
				/>
			)}
		</div>
	);
};
