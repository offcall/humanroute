import { useCallback, useState } from "react";
import { request, usePoll } from "../shared";
import { type Cabinet, parseCabinet } from "./parseCabinet";

export type CabinetState = {
	cabinet: Cabinet | undefined;
	failed: string | undefined;
	reload: () => Promise<void>;
};

// GET /api/linguist, polled: header, My tasks and Wallet read it.
export const useCabinet = (): CabinetState => {
	const [cabinet, setCabinet] = useState<Cabinet>();
	const [failed, setFailed] = useState<string>();

	const reload = useCallback(async () => {
		const res = await request("GET", "/api/linguist", undefined, parseCabinet);
		if (res.ok) {
			setCabinet(res.value);
			setFailed(undefined);
		} else {
			setFailed(res.error.message ?? res.error.error);
		}
	}, []);

	usePoll(reload);

	return { cabinet, failed, reload };
};
