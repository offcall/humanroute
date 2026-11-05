import "./invite.css";
import type { ReactNode } from "react";
import { Avatar, Icon, IconName } from "../shared";
import { type Invite, InviteState } from "./useInvite";

type Props = { invite: Invite; inviteCode: string; children: ReactNode };

const FIELDS: [string, string][] = [
	["You join as", "Translator"],
	["Paid in", "USDC"],
	["Network", "Devnet"],
];

const Fields = () => (
	<div className="ticket__fields">
		{FIELDS.map(([label, value]) => (
			<div key={label}>
				<span>{label}</span>
				<b>{value}</b>
			</div>
		))}
	</div>
);

const Skeleton = () => (
	<div className="invite__agency">
		<Avatar name={null} />
		<div className="stack stack--sm invite__grow">
			<div className="skeleton skeleton--line invite__w30" />
			<div className="skeleton skeleton--title invite__w70" />
		</div>
	</div>
);

const AgencyLine = ({ invite }: { invite: Invite }) => {
	const notFound = invite.state === InviteState.NotFound;
	const name = invite.state === InviteState.Found ? invite.agency.name : null;
	const text = notFound ? "Agency unknown" : (name ?? "Shown after you join");

	return (
		<div className={notFound ? "invite__agency is-unknown" : "invite__agency"}>
			<Avatar name={name} />
			<div>
				<span className="label label--sm">
					{notFound ? "Invite" : "Agency"}
				</span>
				<b id="invite-agency" dir="auto">
					{text}
				</b>
			</div>
		</div>
	);
};

export const InviteTicket = ({ invite, inviteCode, children }: Props) => {
	const loading = invite.state === InviteState.Loading;
	const notFound = invite.state === InviteState.NotFound;

	return (
		<article
			className="ticket"
			aria-busy={loading || undefined}
			aria-label={loading ? "Invite, loading" : undefined}
			aria-labelledby={loading ? undefined : "invite-agency"}
		>
			<div className="ticket__body">
				{loading ? <Skeleton /> : <AgencyLine invite={invite} />}
				{loading || notFound ? null : <Fields />}
			</div>
			<div className="ticket__perf" aria-hidden="true" />
			<div className="ticket__stub">
				<div className="invite__code">
					<div>
						<span>Invite code</span>
						<b className={notFound ? "is-void" : undefined}>{inviteCode}</b>
					</div>
					{notFound ? (
						<span className="invite__flag">
							<Icon name={IconName.Cross} size={16} />
							Not found
						</span>
					) : null}
				</div>
				{children}
			</div>
		</article>
	);
};
