import { formatUsdc } from "../shared";

type Props = { state: string; priceUnits: bigint };

export const MoneyLine = ({ state, priceUnits }: Props) => (
	<span>
		{state} · {formatUsdc(priceUnits)}
	</span>
);
