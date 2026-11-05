import { useCallback, useState } from "react";
import { type Order, parseOrders, request, usePoll } from "../shared";
import type { OrdersState } from "./types";

type Loaded = { orders: Order[]; serverTime: string };

// Polls GET /api/orders; a failed poll keeps the last data and sets the error.
export const useOrders = (): OrdersState => {
	const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	const load = useCallback(async () => {
		const res = await request("GET", "/api/orders", undefined, parseOrders);
		if (!res.ok) {
			setError(res.error.message ?? res.error.error);
			return;
		}
		setError(undefined);
		setLoaded(res.value);
	}, []);

	usePoll(() => void load());
	const reload = useCallback(() => void load(), [load]);

	return {
		orders: loaded?.orders,
		serverTime: loaded?.serverTime,
		error,
		reload,
	};
};
