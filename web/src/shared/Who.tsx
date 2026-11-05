import { Avatar, type AvatarTone } from "./Avatar";
import type { Agency } from "./types";

type Props = {
	agency: Agency | null;
	translatorNo: number | null;
	tone?: AvatarTone | undefined;
};

// Executor: agency name + "translator #N"; nobody yet while the task is open.
export const Who = ({ agency, translatorNo, tone }: Props) => (
	<div className="who">
		<Avatar name={agency === null ? null : agency.name} tone={tone} />
		<div>
			<b className="who__name">
				{agency === null ? "No translator yet" : agency.name}
			</b>
			{translatorNo === null ? null : (
				<span className="who__sub">translator #{translatorNo}</span>
			)}
		</div>
	</div>
);
