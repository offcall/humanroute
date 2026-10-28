import { Agency } from "./agency";
import { Firm } from "./firm";
import { Join } from "./join";
import { Landing } from "./landing";
import { Linguist } from "./linguist";
import { PayPage } from "./pay";
import { matchPath, useRoute } from "./shared";

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
		return <PayPage draftId={draftId} />;
	}

	return <Landing />;
};
