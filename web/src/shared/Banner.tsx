import type { ReactNode } from "react";
import { Icon, IconName } from "./Icon";

type Props = {
	children: ReactNode;
	onClick: () => void;
	label?: string;
	sticky?: boolean;
	icon?: IconName;
};

// Accent-soft button banner: "3 new jobs · Show"
export const Banner = ({
	children,
	onClick,
	label,
	sticky = false,
	icon = IconName.Chev,
}: Props) => (
	<button
		type="button"
		className={sticky ? "banner banner--sticky" : "banner"}
		aria-label={label}
		onClick={onClick}
	>
		<span>{children}</span>
		<Icon name={icon} size={20} />
	</button>
);

type CtaProps = { title: string; detail?: string; action: ReactNode };

// Banner with a title, a detail line and an action: "2 translations wait for your review"
export const CtaBanner = ({ title, detail, action }: CtaProps) => (
	<div className="cta-banner">
		<div>
			<b>{title}</b>
			{detail === undefined ? null : <span>{detail}</span>}
		</div>
		{action}
	</div>
);
