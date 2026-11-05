import "./approve.css";
import {
	getPhantom,
	Icon,
	IconName,
	matchPath,
	phantomDeepLink,
	Spinner,
	useRoute,
} from "../shared";
import { Shell } from "./ApproveShell";
import { ApproveStep, useApprove } from "./useApprove";

const DONE_TEXT: Partial<Record<ApproveStep, string>> = {
	[ApproveStep.Approved]: "Approved. Safari signs in as soon as you return.",
	[ApproveStep.Rejected]: "Rejected. Nobody was signed in.",
};

// Runs inside Phantom's browser; it never opens a cabinet here (ADR 0034).
const Approve = ({ requestId }: { requestId: string }) => {
	const { step, error, approve, reject } = useApprove(requestId);
	const done = DONE_TEXT[step];
	const busy = step === ApproveStep.Approving || step === ApproveStep.Rejecting;

	if (done !== undefined) {
		return (
			<Shell>
				<h1>Done, go back to Safari</h1>
				<p className="alert alert--success" role="status">
					<Icon name={IconName.Check} />
					{done}
				</p>
			</Shell>
		);
	}

	return (
		<Shell>
			<h1>Sign in to HumanRoute?</h1>
			<p className="alert alert--info">
				<b>Approve only if you just tapped Sign in yourself.</b>
			</p>
			{error === undefined ? null : (
				<p className="alert alert--error" role="alert">
					<Icon name={IconName.Alarm} />
					{error}
				</p>
			)}
			{step === ApproveStep.Closed ? (
				<p className="approve__note">Done, go back to Safari.</p>
			) : (
				<div className="stack stack--sm">
					<button
						type="button"
						className="btn btn--primary btn--lg btn--block"
						disabled={busy}
						aria-busy={step === ApproveStep.Approving}
						onClick={approve}
					>
						{step === ApproveStep.Approving ? <Spinner /> : null}
						{step === ApproveStep.Approving ? "Approving…" : "Approve"}
					</button>
					<button
						type="button"
						className="btn btn--ghost btn--lg btn--block"
						disabled={busy}
						aria-busy={step === ApproveStep.Rejecting}
						onClick={reject}
					>
						Reject
					</button>
					<p className="approve__note">
						Phantom asks twice: connect, then sign. No payment, no fee.
					</p>
				</div>
			)}
		</Shell>
	);
};

export const ApprovePage = () => {
	const requestId = matchPath("/approve/:id", useRoute())?.id;

	if (requestId === undefined) {
		return null;
	}
	if (getPhantom() === undefined) {
		return (
			<Shell>
				<h1>Open in Phantom</h1>
				<p className="approve__note">
					This approve page works in the Phantom app.
				</p>
				<a
					className="btn btn--primary btn--lg btn--block"
					href={phantomDeepLink(window.location.href)}
				>
					Open in Phantom
				</a>
			</Shell>
		);
	}

	return <Approve requestId={requestId} />;
};
