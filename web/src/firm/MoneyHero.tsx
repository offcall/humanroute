import { usdcNumber } from "./format";
import type { Summary } from "./summary";

// 76 px escrow number with the running count and today's settled money
export const MoneyHero = ({ summary }: { summary: Summary }) => {
	const parts = [
		"USDC in escrow",
		`${summary.running} running`,
		`${usdcNumber(summary.paidTodayUnits)} paid out today`,
	];
	if (summary.refundedTodayUnits > 0n) {
		parts.push(`${usdcNumber(summary.refundedTodayUnits)} refunded today`);
	}

	return (
		<div className="money">
			<b className="num-money">{usdcNumber(summary.escrowUnits)}</b>
			<span>{parts.join(" · ")}</span>
		</div>
	);
};
