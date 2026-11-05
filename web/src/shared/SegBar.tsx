import type { Status } from "./status";

type Props = { status: Status; labelled?: boolean };

const SEGMENTS = 4;

const segClass = (status: Status, index: number): string => {
	if (index < status.step) {
		return "is-done";
	}
	if (!status.crossed) {
		return index === status.step ? "is-now" : "";
	}
	if (index < SEGMENTS - 1) {
		return "is-skipped";
	}

	return status.final ? "is-void" : "is-now";
};

const labels = (status: Status): string[] => [
	"Open",
	"Claimed",
	"Submitted",
	status.crossed ? "Refunded" : "Paid out",
];

const progressLabel = (status: Status): string =>
	status.step >= SEGMENTS
		? "Progress: all 4 steps done"
		: `Progress: step ${currentOf(status) + 1} of 4`;

// The segment the task is on now: the last one once it ends or is refunded.
const currentOf = (status: Status): number =>
	status.crossed || status.step >= SEGMENTS ? SEGMENTS - 1 : status.step;

// 4 segments: compact bar (aria-hidden, the tag says the word) or labelled list for task detail
export const SegBar = ({ status, labelled = false }: Props) => {
	const names = labels(status);
	if (!labelled) {
		return (
			<div className="seg-bar seg-bar--mini" aria-hidden="true">
				{names.map((name, index) => (
					<i key={name} className={segClass(status, index)} />
				))}
			</div>
		);
	}

	return (
		<ol className="seg-bar" aria-label={progressLabel(status)}>
			{names.map((name, index) => (
				<li
					key={name}
					className={segClass(status, index)}
					aria-current={index === currentOf(status) ? "step" : undefined}
				>
					{name}
				</li>
			))}
		</ol>
	);
};
