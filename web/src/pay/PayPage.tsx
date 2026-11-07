import "./pay.css";
import "./pay-states.css";
import { useEffect, useState } from "react";
import { useSession } from "../shared";
import { checkStatus } from "./checkStatus";
import { loadDraft } from "./loadDraft";
import { PayBody } from "./PayBody";
import { PayHead } from "./PayHead";
import { PayTop } from "./PayTop";
import { payOrder } from "./pay";
import { type PageStatus, Step } from "./status";
import type { DraftView } from "./types";
import { connectPhantom, getPhantom } from "./wallet";

export const PayPage = ({ draftId }: { draftId: string }) => {
	const [status, setStatus] = useState<PageStatus>({ name: Step.Loading });
	const [payer, setPayer] = useState<string>();
	const { me } = useSession();
	const phantom = getPhantom();

	useEffect(() => {
		let active = true;
		setStatus({ name: Step.Loading });
		void loadDraft(draftId).then((next) => {
			if (active) {
				setStatus(next);
			}
		});

		return () => {
			active = false;
		};
	}, [draftId]);

	const reload = () => {
		setStatus({ name: Step.Loading });
		void loadDraft(draftId).then(setStatus);
	};

	const pay = async (draft: DraftView) => {
		if (phantom === undefined) {
			return;
		}
		setStatus({ name: Step.Paying, draft });
		const wallet = await connectPhantom(phantom);
		if (!wallet.ok) {
			setStatus({
				name: Step.Failed,
				message: wallet.error,
				draft,
				checked: false,
			});
			return;
		}
		setPayer(wallet.value.address);
		const paid = await payOrder({
			draftId,
			totalUnits: draft.totalUnits,
			signer: wallet.value.signer,
		});
		setStatus(
			paid.ok
				? { name: Step.Paid, draft, result: paid.value }
				: { name: Step.Failed, message: paid.error, draft, checked: false },
		);
	};

	const title =
		status.name === Step.AlreadyPaid
			? "Already paid"
			: status.name === Step.Orphaned
				? "Payment taken, no order"
				: "Pay for translation";

	return (
		<div className="app pay-shell theme-big">
			<div className="app__main">
				<PayTop payer={payer} busy={status.name === Step.Paying} />
				<main className="pay">
					{status.name === Step.Paid ? null : (
						<PayHead draftId={draftId}>
							<h1 className="h1">{title}</h1>
						</PayHead>
					)}
					<PayBody
						status={status}
						payer={payer}
						guest={me === null}
						onPay={(draft) => void pay(draft)}
						onCheck={(failed) => void checkStatus(failed).then(setStatus)}
						onReload={reload}
					/>
				</main>
			</div>
		</div>
	);
};
