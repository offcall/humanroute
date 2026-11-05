import { lazy, Suspense, useEffect } from "react";
import { Agency } from "./agency";
import { ApprovePage } from "./approve";
import { Firm } from "./firm";
import { Join } from "./join";
import { Landing } from "./landing";
import { Linguist } from "./linguist";
import { matchPath, navigate, useRoute } from "./shared";

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
	if (matchPath("/approve/:id", path)) {
		return <ApprovePage />;
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

// Each page draws its own wallet line (firm header, linguist Wallet tab, landing, join, agency, pay).
export const Routes = () => <Page />;
