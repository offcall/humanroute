// Header of the two setup steps: title, Cancel, and a two-part progress bar.
export const SetupHead = ({
	step,
	onCancel,
}: {
	step: 1 | 2;
	onCancel: () => void;
}) => (
	<>
		<div className="ap-row">
			<h3 className="ap-title ap-grow">Set up auto-pay</h3>
			<button type="button" className="btn btn--text" onClick={onCancel}>
				Cancel
			</button>
		</div>
		<ol className="ap-steps">
			<li
				className={
					step === 1 ? "ap-step ap-step--cur" : "ap-step ap-step--done"
				}
			>
				{step === 1 ? "1 · Agent key" : "✓ Agent key"}
			</li>
			<li className={step === 2 ? "ap-step ap-step--cur" : "ap-step"}>
				2 · Limit in Phantom
			</li>
		</ol>
	</>
);
