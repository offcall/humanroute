import type { MouseEvent } from "react";
import { navigate } from "../shared";
import { TabIcon, TabIconName } from "./TabIcon";
import { TAB_PATH, TAB_TITLE, Tab } from "./tabs";
import "./tabbar.css";

const ICON: Record<Tab, TabIconName> = {
	[Tab.Board]: TabIconName.Board,
	[Tab.Tasks]: TabIconName.Tasks,
	[Tab.Wallet]: TabIconName.Wallet,
};

type Props = { current: Tab; fresh: number };

const open = (event: MouseEvent<HTMLAnchorElement>, tab: Tab) => {
	event.preventDefault();
	navigate(TAB_PATH[tab]);
};

export const Tabbar = ({ current, fresh }: Props) => (
	<nav className="tabbar" aria-label="Main">
		{Object.values(Tab).map((tab) => (
			<a
				key={tab}
				className="tabbar__tab"
				href={TAB_PATH[tab]}
				aria-current={tab === current ? "page" : undefined}
				onClick={(event) => open(event, tab)}
			>
				<TabIcon name={ICON[tab]} />
				{TAB_TITLE[tab]}
				{tab === Tab.Board && fresh > 0 ? (
					<span className="tabbar__count">
						<span className="visually-hidden">, </span>
						{fresh}
						<span className="visually-hidden"> new</span>
					</span>
				) : null}
			</a>
		))}
	</nav>
);
