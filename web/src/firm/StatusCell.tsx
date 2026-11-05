import { Icon, IconName, SegBar, type Status, TagKind } from "../shared";

// In-flight money pulses; a stopped transfer keeps a still dot.
const mark = (status: Status, failed: boolean) => {
	switch (status.tagKind) {
		case TagKind.Paid:
			return <Icon name={IconName.Check} size={24} />;
		case TagKind.Refunded:
			return <Icon name={IconName.Undo} size={24} />;
		case TagKind.Paying:
		case TagKind.Refunding:
			return (
				<i
					className={
						failed ? "dot fb-dot--amber" : "dot dot--pulse fb-dot--amber"
					}
					aria-hidden="true"
				/>
			);
		default:
			return null;
	}
};

type Props = { status: Status; failed: boolean };

export const StatusCell = ({ status, failed }: Props) => (
	<div className="cell-status">
		<b>
			{mark(status, failed)}
			{status.word}
		</b>
		<SegBar status={status} />
	</div>
);
