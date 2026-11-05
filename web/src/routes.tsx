import { lazy, Suspense, useEffect } from "react";
import { Agency } from "./agency";
import { Firm } from "./firm";
import { Join } from "./join";
import { Landing } from "./landing";
import { Linguist } from "./linguist";
import {
	matchPath,
	navigate,
	useRoute,
	useSession,
	WalletLine,
} from "./shared";

// The pay page carries the wallet and payment code; it loads only when a /pay/ link is opened.
const PayPage = lazy(() =>
	import("./pay").then((module) => ({ default: module.PayPage })),
);

const FirmJobsRedirect = () => {
	useEffect(() => navigate("/firm/jobs", true), []);

	return null;
};

const Page = () => {
	const path = useRoute();
	const join = matchPath("/join/:inviteCode", path);

	if (matchPath("/firm", path)) {
		return <FirmJobsRedirect />;
	}
	if (matchPath("/firm/*", path)) {
		return <Firm />;
	}
	if (matchPath("/agency", path)) {
		return <Agency />;
	}
	if (matchPath("/linguist/*", path)) {
		return <Linguist />;
	}
	if (join) {
		return <Join />;
	}
	const draftId = matchPath("/pay/:draftId", path)?.draftId;
	if (draftId !== undefined) {
		return (
			<Suspense fallback={null}>
				<PayPage draftId={draftId} />
			</Suspense>
		);
	}

	return <Landing />;
};

// The signed-in wallet shows above every page; pay shows the payer itself when there is no session.
const SessionWallet = () => {
	const { me, signOut } = useSession();

	return me === null ? null : (
		<WalletLine wallet={me.wallet} onSignOut={signOut} />
	);
};

export const Routes = () => (
	<>
		<SessionWallet />
		<Page />
	</>
);
