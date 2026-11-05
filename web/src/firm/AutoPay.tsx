import { useState } from "react";
import { TxLink } from "../shared";
import { AgentSetup } from "./AgentSetup";
import { AutoPayForm, agentFromUrl } from "./AutoPayForm";
import { AutoPayState } from "./AutoPayState";
import { useAutopay } from "./useAutopay";

// Auto-pay (ADR 0036): the firm lets its agent key spend up to a limit from its own USDC account.
// Step 1 runs the setup command; step 2 approves the limit in Phantom.
export const AutoPay = () => {
	const { status, busy, note, lastTx, run } = useAutopay();
	const [ranSetup, setRanSetup] = useState(agentFromUrl() !== "");

	return (
		<section className="stack" aria-label="Auto-pay by Claude">
			<p className="field__hint">
				Optional. Claude pays orders itself from your own USDC account, up to a
				limit; the money stays in your wallet until then.
			</p>
			{status === undefined ? null : <AutoPayState status={status} />}
			{status === undefined || ranSetup ? null : (
				<AgentSetup status={status} onDone={() => setRanSetup(true)} />
			)}
			{status === undefined || !ranSetup ? null : (
				<AutoPayForm
					status={status}
					busy={busy}
					run={run}
					onBack={() => setRanSetup(false)}
				/>
			)}
			{note === undefined ? null : <p role="status">{note}</p>}
			{lastTx === undefined ? null : <TxLink signature={lastTx} />}
		</section>
	);
};
