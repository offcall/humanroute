import "./ticket.css";
import "./join.css";
import {
	getPhantom,
	matchPath,
	useRoute,
	useSession,
	WalletLine,
} from "../shared";
import { InviteTicket } from "./InviteTicket";
import { JoinAlert } from "./JoinAlert";
import { JoinShell } from "./JoinShell";
import { JoinSteps } from "./JoinSteps";
import { JoinStub, StubKind } from "./JoinStub";
import { InviteState, useInvite } from "./useInvite";
import { JoinBusy, useJoin } from "./useJoin";

const stubKind = (state: InviteState, sessionLoading: boolean): StubKind => {
	if (state === InviteState.Loading || sessionLoading) {
		return StubKind.Loading;
	}
	if (state === InviteState.NotFound) {
		return StubKind.NotFound;
	}

	return getPhantom() === undefined ? StubKind.NoPhantom : StubKind.Ready;
};

const JoinInvite = ({ inviteCode }: { inviteCode: string }) => {
	const invite = useInvite(inviteCode);
	const { me, loading, signOut } = useSession();
	const { busy, error, join } = useJoin(inviteCode);
	const kind = stubKind(invite.state, loading);
	const signedIn = me !== null;
	const open = kind !== StubKind.Loading && kind !== StubKind.NotFound;
	const calm = open && error === undefined;

	return (
		<JoinShell
			lead={!signedIn && kind !== StubKind.NotFound && error === undefined}
		>
			{me === null || kind === StubKind.NotFound ? null : (
				<div className="join-wallet">
					<WalletLine
						wallet={me.wallet}
						onSignOut={signOut}
						signOutDisabled={busy !== JoinBusy.Idle}
					/>
				</div>
			)}
			<InviteTicket invite={invite} inviteCode={inviteCode}>
				<JoinStub
					kind={kind}
					signedIn={signedIn}
					busy={busy}
					error={error}
					onJoin={join}
				/>
			</InviteTicket>
			{kind === StubKind.NotFound ? <JoinAlert error={undefined} /> : null}
			{open && error !== undefined ? <JoinAlert error={error} /> : null}
			{calm ? (
				<JoinSteps
					agencyName={
						invite.state === InviteState.Found ? invite.agency.name : null
					}
					signedIn={signedIn}
					noPhantom={kind === StubKind.NoPhantom}
				/>
			) : null}
			{calm && !signedIn && kind === StubKind.Ready ? (
				<p className="join-foot">
					{window.location.host}/join/<code>{inviteCode}</code>
				</p>
			) : null}
		</JoinShell>
	);
};

export const JoinPage = () => {
	const path = useRoute();
	const inviteCode = matchPath("/join/:inviteCode", path)?.inviteCode;

	return inviteCode === undefined ? (
		<JoinShell lead={false}>
			<JoinAlert error={undefined} />
		</JoinShell>
	) : (
		<JoinInvite inviteCode={inviteCode} />
	);
};
