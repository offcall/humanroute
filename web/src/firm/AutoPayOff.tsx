// Auto-pay off: one quiet row with a Set up button.
export const AutoPayOff = ({ onSetup }: { onSetup: () => void }) => (
	<div className="ap-row">
		<span className="ap-badge">Off</span>
		<div className="ap-grow">
			<h3 className="ap-title">Auto-pay by Claude</h3>
			<p className="ap-muted">
				Claude pays orders itself from your own wallet, up to a limit.
			</p>
		</div>
		<button type="button" className="btn btn--ghost btn--sm" onClick={onSetup}>
			Set up
		</button>
	</div>
);
