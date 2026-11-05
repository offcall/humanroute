import { useState } from "react";
import { formatUsdc } from "../shared";
import { FundsWarning, hasFeeSol } from "./AutoPayState";
import type { Autopay } from "./autopayParse";
import { parseUsdcInput } from "./autopayTx";
import { WalletFunds } from "./WalletFunds";

// The setup command opens the cabinet with ?agent=<public key>.
export const agentFromUrl = (): string =>
	new URLSearchParams(window.location.search).get("agent") ?? "";
const BASE58_KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PRESETS = ["1", "5", "10"];

type Props = {
	status: Autopay;
	busy: boolean;
	onApprove: (agent: string, units: bigint) => void;
	onBack: () => void;
};

// Step 2: the printed public key and a total limit; Phantom signs the allowance.
export const AutoPayForm = ({ status, busy, onApprove, onBack }: Props) => {
	const [agent, setAgent] = useState(agentFromUrl() || (status.delegate ?? ""));
	const [limit, setLimit] = useState("5");
	const units = parseUsdcInput(limit);
	const key = agent.trim();
	const ready = status.exists && hasFeeSol(status) && units !== undefined;
	const canApprove = ready && BASE58_KEY.test(key) && !busy;

	return (
		<>
			<div className="field">
				<label className="field__label" htmlFor="autopay-agent">
					Agent public key
				</label>
				<input
					className="input mono ap-key"
					id="autopay-agent"
					value={agent}
					placeholder="Paste the “Agent public key” line from the terminal"
					onChange={(event) => setAgent(event.target.value)}
				/>
			</div>
			<div className="field">
				<label className="field__label" htmlFor="autopay-limit">
					Limit
				</label>
				<div className="ap-row">
					<input
						className="input ap-amount"
						id="autopay-limit"
						inputMode="decimal"
						value={limit}
						onChange={(event) => setLimit(event.target.value)}
					/>
					<span>USDC</span>
					{PRESETS.map((preset) => (
						<button
							key={preset}
							type="button"
							className="ap-chip"
							aria-pressed={limit === preset}
							onClick={() => setLimit(preset)}
						>
							{preset}
						</button>
					))}
				</div>
				<span className="field__hint">
					Total, not per month; a new limit replaces the old one
					{units === undefined ? "" : ` (${formatUsdc(units)})`}. Wallet:{" "}
					<WalletFunds status={status} />
				</span>
			</div>
			<FundsWarning status={status} />
			<div className="ap-row">
				<button
					type="button"
					className="btn btn--primary"
					disabled={!canApprove}
					onClick={() => units !== undefined && onApprove(key, units)}
				>
					Allow in Phantom
				</button>
				<button type="button" className="btn btn--text" onClick={onBack}>
					← Step 1
				</button>
			</div>
		</>
	);
};
