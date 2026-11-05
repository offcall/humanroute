import type { MouseEvent } from "react";
import { Icon, IconName, navigate } from "../shared";

const open = (event: MouseEvent) => {
	event.preventDefault();
	navigate("/firm");
};

export const FirmLink = ({ small = false }: { small?: boolean }) => (
	<a
		className={small ? "btn btn--primary btn--sm" : "btn btn--primary"}
		href="/firm"
		onClick={open}
	>
		Open firm cabinet
		<Icon name={IconName.Arrow} size={18} />
	</a>
);
