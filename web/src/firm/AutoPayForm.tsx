import { useState } from "react";
import { formatUsdc } from "../shared";
import { hasFeeSol } from "./AutoPayState";
import type { Autopay } from "./autopayParse";
import { approveTx, parseUsdcInput, revokeTx } from "./autopayTx";

// The setup command opens the cabinet with ?agent=<public key>.
export const agentFromUrl = (): string =>
	new URLSearchParams(window.location.search).get("agent") ?? "";
const BASE58_KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type Props = {
	status: Autopay;
	busy: boolean;
	run: (build: (current: Autopay) => ReturnType<typeof revokeTx>) => void;
	onBack: () => void;
};

// Step 2 of auto-pay: the printed public key, a limit, then Phantom approves or revokes.
export const AutoPayForm = ({ status, busy, run, onBack }: Props) => {
	const [agent, setAgent] = useState(agentFromUrl);
	const [limit, setLimit] = useState("5");
	const units = parseUsdcInput(limit);
	const keyOk = BASE58_KEY.test(agent.trim());
	const feeOk = hasFeeSol(status);
	const canEnable =
		status.exists && feeOk && units !== undefined && keyOk && !busy;
	const enable = () =>
		units === undefined
			? undefined
			: run((current) => approveTx(current, agent.trim(), units));

	return (
		<div className="stack">
			<p className="desk-hint">
				Step 2 of 2. Paste the public key the command printed and set the limit.
				Phantom (on devnet) signs the allowance.
			</p>
			<div className="field">
				<label className="field__label" htmlFor="autopay-agent">
					Agent public key
				</label>
				<input
					className="input mono"
					id="autopay-agent"
					value={agent}
					placeholder="Agent public key: …"
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
					Replaces the old limit
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
					disabled={busy || !feeOk || status.delegate === null}
					onClick={() => run(revokeTx)}
				>
					Turn off
				</button>
				<button type="button" className="btn btn--text" onClick={onBack}>
					Back to the command
				</button>
			</div>
		</div>
	);
};
