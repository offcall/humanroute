import { useState } from "react";
import { formatUsdc, TxLink } from "../shared";
import { AgentSetup } from "./AgentSetup";
import { AutoPayState } from "./AutoPayState";
import { approveTx, parseUsdcInput, revokeTx } from "./autopayTx";
import { useAutopay } from "./useAutopay";

// The setup command opens the cabinet with ?agent=<public key>.
const agentFromUrl = (): string =>
	new URLSearchParams(window.location.search).get("agent") ?? "";
const BASE58_KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Auto-pay (ADR 0036): the firm lets its agent key spend up to a limit from its own USDC account.
export const AutoPay = () => {
	const [agent, setAgent] = useState(agentFromUrl);
	const [limit, setLimit] = useState("5");
	const { status, busy, note, lastTx, run } = useAutopay();

	const units = parseUsdcInput(limit);
	const keyOk = BASE58_KEY.test(agent.trim());
	const canEnable =
		status?.exists === true && units !== undefined && keyOk && !busy;
	const enable = () =>
		units === undefined
			? undefined
			: run((current) => approveTx(current, agent.trim(), units));

	return (
		<section className="stack" aria-labelledby="autopay-title">
			<h3 className="h3" id="autopay-title">
				Auto-pay by Claude
			</h3>
			<p className="desk-hint">
				Your agent key may spend up to a limit from your own USDC account. The
				money stays in your wallet until Claude pays an order. Phantom must be
				on Solana devnet.
			</p>
			{status === undefined ? null : <AgentSetup status={status} />}
			{status === undefined ? null : <AutoPayState status={status} />}
			<div className="field">
				<label className="field__label" htmlFor="autopay-agent">
					Agent public key
				</label>
				<input
					className="input mono"
					id="autopay-agent"
					value={agent}
					onChange={(event) => setAgent(event.target.value)}
				/>
			</div>
			<div className="field">
				<label className="field__label" htmlFor="autopay-limit">
					Limit, USDC
				</label>
				<input
					className="input"
					id="autopay-limit"
					inputMode="decimal"
					value={limit}
					onChange={(event) => setLimit(event.target.value)}
				/>
				<span className="field__hint">
					A new limit replaces the old one
					{units === undefined ? "" : `: ${formatUsdc(units)} in total`}.
				</span>
			</div>
			<div className="row">
				<button
					type="button"
					className="btn btn--primary"
					disabled={!canEnable}
					onClick={enable}
				>
					Enable auto-pay
				</button>
				<button
					type="button"
					className="btn btn--ghost"
					disabled={busy || status === undefined || status.delegate === null}
					onClick={() => run(revokeTx)}
				>
					Turn off
				</button>
			</div>
			{note === undefined ? null : <p role="status">{note}</p>}
			{lastTx === undefined ? null : <TxLink signature={lastTx} />}
		</section>
	);
};
