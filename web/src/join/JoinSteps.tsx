import "./steps.css";
import { Icon, IconName } from "../shared";

type Props = {
	agencyName: string | null;
	signedIn: boolean;
	noPhantom: boolean;
};

// What happens next: done = filled + check, now = indigo, todo = outline.
export const JoinSteps = ({ agencyName, signedIn, noPhantom }: Props) => (
	<ol className="steps" aria-label="What happens next">
		<li
			className={signedIn ? "is-done" : "is-now"}
			aria-current={signedIn ? undefined : "step"}
		>
			<span className="steps__dot" aria-hidden="true">
				{signedIn ? <Icon name={IconName.Check} size={15} /> : "1"}
			</span>
			<span>
				<b>Sign in with Phantom</b>
				{noPhantom ? ", approve there, then come back here" : null}
				{signedIn ? <span className="visually-hidden"> (done)</span> : null}
			</span>
		</li>
		<li
			className={signedIn ? "is-now" : undefined}
			aria-current={signedIn ? "step" : undefined}
		>
			<span className="steps__dot" aria-hidden="true">
				2
			</span>
			<span>
				<b>
					Join{" "}
					{agencyName === null ? (
						"the agency"
					) : (
						<span dir="auto">{agencyName}</span>
					)}
				</b>
			</span>
		</li>
		<li>
			<span className="steps__dot" aria-hidden="true">
				3
			</span>
			<span>
				<b>Pick your language pairs</b>, then claim jobs on the Board
			</span>
		</li>
	</ol>
);
