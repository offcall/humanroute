import { useState } from "react";
import { AgentSetup } from "./AgentSetup";
import { AutoPayForm, agentFromUrl, clearAgentLink } from "./AutoPayForm";
import { AutoPayOff } from "./AutoPayOff";
import { AutoPayOn } from "./AutoPayOn";
import { rememberLimit } from "./autopayLimit";
import { approveTx, revokeTx } from "./autopayTx";
import { SetupHead } from "./SetupHead";
import type { AutopayControl } from "./useAutopay";
import "./autopay.css";
import "./autopay-parts.css";

enum View {
	Summary = "summary",
	Key = "key",
	Limit = "limit",
}

// Auto-pay (ADR 0036): off row, two setup steps, or the on summary.
export const AutoPay = ({ control }: { control: AutopayControl }) => {
	const { status, busy, note, lastTx, run } = control;
	const [view, setView] = useState(
		agentFromUrl() === "" ? View.Summary : View.Limit,
	);
	if (status === undefined) {
		return note === undefined ? null : (
			<p className="ap-card ap-muted">{note}</p>
		);
	}

	const approve = async (agent: string, units: bigint) => {
		if (await run((current) => approveTx(current, agent, units))) {
			rememberLimit(agent, units);
			clearAgentLink();
			setView(View.Summary);
		}
	};
	const cancel = () => {
		clearAgentLink();
		setView(View.Summary);
	};
	const { delegate } = status;
	const on = delegate !== null && status.allowanceUnits > 0n;
	let body: React.ReactNode;
	if (view === View.Key) {
		body = (
			<>
				<SetupHead step={1} onCancel={cancel} />
				<AgentSetup status={status} onDone={() => setView(View.Limit)} />
			</>
		);
	} else if (view === View.Limit) {
		body = (
			<>
				<SetupHead step={2} onCancel={cancel} />
				<AutoPayForm
					status={status}
					busy={busy}
					onApprove={approve}
					onBack={() => setView(View.Key)}
				/>
			</>
		);
	} else if (on) {
		body = (
			<AutoPayOn
				status={{ ...status, delegate }}
				lastTx={lastTx}
				busy={busy}
				onChange={() => setView(View.Limit)}
				onOff={() => void run(revokeTx)}
			/>
		);
	} else {
		body = <AutoPayOff onSetup={() => setView(View.Key)} />;
	}

	return (
		<section className="ap-card stack" aria-label="Auto-pay by Claude">
			{body}
			{note === undefined ? null : (
				<p role="status" className="ap-muted">
					{note}
				</p>
			)}
		</section>
	);
};
