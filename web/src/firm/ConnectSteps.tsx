// The three "Then" steps of the empty-state hero; step 3 depends on auto-pay.
export const ConnectSteps = ({ autopayOn }: { autopayOn: boolean }) => (
	<ol className="fb-steps" aria-label="Then">
		<li>
			<b>1</b>
			<span>
				<strong>Run the command</strong> in your terminal. The token is your
				firm's; keep it private.
			</span>
		</li>
		<li>
			<b>2</b>
			<span>
				<strong>Ask Claude</strong> “Translate this leaflet into Spanish, French
				and German with HumanRoute.”
			</span>
		</li>
		<li>
			<b>3</b>
			<span>
				{autopayOn ? (
					<>
						<strong>Claude pays itself</strong> with auto-pay, up to your limit
						below. The USDC waits in escrow until you approve.
					</>
				) : (
					<>
						<strong>Pay the link</strong> Claude gives you with Phantom. The
						USDC waits in escrow until you approve.
					</>
				)}
			</span>
		</li>
	</ol>
);
