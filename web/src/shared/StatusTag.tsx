import { Icon, IconName } from "./Icon";
import { type Status, TagKind } from "./status";

type Props = { status: Status; large?: boolean };

// waiting: outline; in work: tint + dot; money in flight: pulsing dot; final: fill + icon
const mark = (kind: TagKind) => {
	switch (kind) {
		case TagKind.Open:
			return null;
		case TagKind.Claimed:
		case TagKind.Submitted:
			return <i className="dot" aria-hidden="true" />;
		case TagKind.Paying:
		case TagKind.Refunding:
			return <i className="dot dot--pulse" aria-hidden="true" />;
		case TagKind.Paid:
			return <Icon name={IconName.Check} />;
		case TagKind.Refunded:
			return <Icon name={IconName.Undo} />;
	}
};

export const StatusTag = ({ status, large = false }: Props) => (
	<span className={`tag tag--${status.tagKind}${large ? " tag--lg" : ""}`}>
		{mark(status.tagKind)}
		{status.word}
	</span>
);
