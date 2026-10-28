import { lazy, Suspense } from "react";
import { Agency } from "./agency";
import { Firm } from "./firm";
import { Join } from "./join";
import { Landing } from "./landing";
import { Linguist } from "./linguist";
import { matchPath, useRoute } from "./shared";

// The pay page carries the wallet and payment code; it loads only when a /pay/ link is opened.
const PayPage = lazy(() =>
	import("./pay").then((module) => ({ default: module.PayPage })),
);

export const Routes = () => {
	const path = useRoute();
	const join = matchPath("/join/:inviteCode", path);

	if (matchPath("/firm", path)) {
		return <Firm />;
	}
	if (matchPath("/agency", path)) {
		return <Agency />;
	}
	if (matchPath("/linguist", path)) {
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
