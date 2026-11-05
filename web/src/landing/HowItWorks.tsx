import "./steps.css";

const STEPS: [string, string][] = [
	[
		"Your agent orders",
		"Claude posts the text over MCP and pays one x402 payment in USDC. The gateway holds it.",
	],
	[
		"A linguist fixes it",
		"A linguist of an agency claims the task and sends the translation before the deadline.",
	],
	[
		"You approve, they get paid",
		"Approve: linguist, agency and fee are paid. Reject or no answer in time: you get a refund.",
	],
];

export const HowItWorks = () => (
	<section className="land-steps" aria-labelledby="land-how">
		<h2 className="list-label" id="land-how">
			How it works
		</h2>
		<ol>
			{STEPS.map(([title, text], index) => (
				<li key={title}>
					<span className="land-steps__no" aria-hidden="true">
						{index + 1}
					</span>
					<div>
						<b>{title}</b>
						<p>{text}</p>
					</div>
				</li>
			))}
		</ol>
	</section>
);
