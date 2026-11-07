import { Icon, IconName } from "../shared";

type Props = { checked: boolean; onCheck: () => void };

// Unknown outcome: re-read the draft instead of paying again.
export const CheckStatus = ({ checked, onCheck }: Props) => (
	<>
		<button
			type="button"
			className="btn btn--primary btn--sm"
			onClick={onCheck}
		>
			<Icon name={IconName.Refresh} size={18} />
			Check status
		</button>
		{checked ? (
			<p role="status">
				Not paid yet as far as we can see. It may still be settling: check again
				in a moment. If it stays unpaid, send support the draft id.
			</p>
		) : null}
	</>
);
