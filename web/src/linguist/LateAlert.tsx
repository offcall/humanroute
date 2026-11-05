import { formatClock, Icon, IconName } from "../shared";

type Props = { deadline: string; firmName: string };

// Submit after the work deadline (409 late); the next poll shows the refund.
export const LateAlert = ({ deadline, firmName }: Props) => (
	<div className="alert alert--error" role="alert">
		<Icon name={IconName.Alarm} size={20} />
		<div>
			<b>Too late</b>
			<br />
			Time ended at {formatClock(deadline)}. {firmName} gets its money back.
		</div>
	</div>
);
