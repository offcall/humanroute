// Advisory chain snapshot for draft creation; never prepare or send a payment here.
import { checkAutopay } from "./autopay.js";
import { AutopayStatus, type Draft, type OrdersDeps } from "./types.js";

const CHECK_MS = 2000;

export const draftAutopay = async (
	deps: Pick<OrdersDeps, "firmWallet" | "tokenAccountOf" | "sleep">,
	draft: Draft,
): Promise<AutopayStatus> => {
	const wallet = deps.firmWallet(draft.firmId);
	if (wallet === null) {
		return AutopayStatus.Unknown;
	}

	const controller = new AbortController();
	const deadline = deps
		.sleep(CHECK_MS, controller.signal)
		.then(() => undefined)
		.catch(() => undefined);
	try {
		const account = await Promise.race([deps.tokenAccountOf(wallet), deadline]);
		if (account === undefined || !account.ok) {
			return AutopayStatus.Unknown;
		}

		return checkAutopay(account.value, draft.totalUnits).ok
			? AutopayStatus.Available
			: AutopayStatus.Unavailable;
	} catch {
		return AutopayStatus.Unknown;
	} finally {
		controller.abort();
	}
};
