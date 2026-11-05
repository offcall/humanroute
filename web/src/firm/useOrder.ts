import { useCallback, useState } from "react";
import { type Order, parseOrderView, request, usePoll } from "../shared";

type Loaded = { order: Order; serverTime: string };

export type OrderState = {
	order: Order | undefined;
	serverTime: string | undefined;
	error: string | undefined;
};

// Polls GET /api/orders/:id; a failed poll keeps the last data and sets the error.
export const useOrder = (orderId: string): OrderState => {
	const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	const load = useCallback(async () => {
		const path = `/api/orders/${encodeURIComponent(orderId)}`;
		const res = await request("GET", path, undefined, parseOrderView);
		if (!res.ok) {
			setError(res.error.message ?? res.error.error);
			return;
		}
		setError(undefined);
		setLoaded(res.value);
	}, [orderId]);

	usePoll(() => void load());

	return { order: loaded?.order, serverTime: loaded?.serverTime, error };
};
