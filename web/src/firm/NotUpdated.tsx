import { formatClock, Icon, IconName } from "../shared";

type Props = { error: string; serverTime: string | undefined };

// Poll failed: the last good jobs stay on screen under this line.
export const NotUpdated = ({ error, serverTime }: Props) => {
	if (serverTime === undefined) {
		return <p className="error">{error}</p>;
	}

	return (
		<div className="alert alert--error" role="alert">
			<Icon name={IconName.Refresh} size={18} />
			<div>
				<b>Not updated: {error}.</b> Showing jobs and reject rate from{" "}
				{formatClock(serverTime)}. We keep trying every few seconds.
			</div>
		</div>
	);
};
