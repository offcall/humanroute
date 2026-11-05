import { Fragment } from "react";
import { formatUsdc, pairCodes } from "../shared";
import type { Cabinet } from "./parseCabinet";

type Props = { title: string; cabinet: Cabinet; todayUnits: bigint };

// Big header: title left, agency · translator right; pairs and today's share below.
export const ShellHead = ({ title, cabinet, todayUnits }: Props) => {
	const zero = todayUnits === 0n;

	return (
		<>
			<header className="big-head">
				<h1 className="h-title">{title}</h1>
				<span>
					{cabinet.agency.name} · translator #{cabinet.translatorNo}
				</span>
			</header>
			<p className="big-sub">
				<span>
					Pairs{" "}
					{cabinet.pairs.map((pair, index) => (
						<Fragment key={`${pair.source}-${pair.target}`}>
							{index === 0 ? null : " · "}
							<b>{pairCodes(pair.source, pair.target)}</b>
						</Fragment>
					))}
				</span>
				<span
					className={
						zero ? "big-sub__today big-sub__today--zero" : "big-sub__today"
					}
				>
					Today <b>{zero ? formatUsdc(0n) : `+${formatUsdc(todayUnits)}`}</b>
				</span>
			</p>
		</>
	);
};
