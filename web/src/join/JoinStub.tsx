import type { MouseEvent } from "react";
import { Icon, IconName, navigate, phantomDeepLink, Spinner } from "../shared";
import { JoinButton } from "./JoinButton";
import { JoinBusy, type JoinError, JoinFailure } from "./useJoin";

export enum StubKind {
	Loading = "loading",
	NotFound = "not-found",
	NoPhantom = "no-phantom",
	Ready = "ready",
}

type Props = {
	kind: StubKind;
	signedIn: boolean;
	busy: JoinBusy;
	error: JoinError | undefined;
	onJoin: () => void;
};

const goTo = (path: string) => (event: MouseEvent) => {
	event.preventDefault();
	navigate(path);
};

const Note = ({ text, live }: { text: string; live?: boolean }) => (
	<p className="stub-note" role={live ? "status" : undefined}>
		{text}
	</p>
);

export const JoinStub = ({ kind, signedIn, busy, error, onJoin }: Props) => {
	if (kind === StubKind.Loading) {
		return (
			<p className="stub-loading" role="status">
				<Spinner />
				Loading…
			</p>
		);
	}
	if (kind === StubKind.NotFound) {
		return (
			<a
				className="btn btn--outline-white btn--block"
				href="/"
				onClick={goTo("/")}
			>
				Open HumanRoute
				<Icon name={IconName.Chev} size={18} />
			</a>
		);
	}
	if (kind === StubKind.NoPhantom) {
		return (
			<>
				<a
					className="btn btn--white btn--block"
					href={phantomDeepLink(window.location.href)}
				>
					Open in Phantom
					<Icon name={IconName.Ext} size={16} />
				</a>
				<Note text="No Phantom wallet in this browser. This invite opens in the Phantom app, then you sign in there." />
			</>
		);
	}
	if (error?.kind === JoinFailure.OtherAgency) {
		return (
			<>
				<a
					className="btn btn--white btn--block"
					href="/linguist"
					onClick={goTo("/linguist")}
				>
					Open my cabinet
					<Icon name={IconName.Chev} size={18} />
				</a>
				<JoinButton signedIn={signedIn} busy={busy} demoted onJoin={onJoin} />
			</>
		);
	}

	return (
		<>
			<JoinButton
				signedIn={signedIn}
				busy={busy}
				retry={error?.kind === JoinFailure.Other}
				onJoin={onJoin}
			/>
			{busy === JoinBusy.SignIn ? (
				<Note
					live
					text="Phantom is open. Sign the message there to continue."
				/>
			) : null}
			{busy === JoinBusy.Join ? (
				<Note live text="Your board opens next." />
			) : null}
			{busy === JoinBusy.Idle && !signedIn && error === undefined ? (
				<Note text="Phantom asks you to sign a message. No payment, no fee." />
			) : null}
		</>
	);
};
