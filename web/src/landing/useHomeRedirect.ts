import { useEffect } from "react";
import { type Me, navigate, useSession } from "../shared";

// Only a page load that opens "/" redirects; the logo link back home still shows the landing.
let redirectDue = window.location.pathname === "/";

const cabinetPath = (me: Me | null): string | undefined => {
	if (me === null) {
		return undefined;
	}
	if (me.firm !== null) {
		return "/firm/jobs";
	}
	if (me.agency !== null) {
		return "/agency";
	}
	if (me.linguist !== null) {
		return "/linguist";
	}

	return undefined;
};

// True only while a redirect to a cabinet is under way; the landing shows while the session loads.
export const useHomeRedirect = (): boolean => {
	const { me, loading } = useSession();
	const target = redirectDue && !loading ? cabinetPath(me) : undefined;

	useEffect(() => {
		if (loading || !redirectDue) {
			return;
		}
		redirectDue = false;
		if (target !== undefined) {
			navigate(target, true);
		}
	}, [loading, target]);

	return target !== undefined;
};
