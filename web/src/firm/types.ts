import type { Firm, Order } from "../shared";

export type Mcp = { url: string; token: string };

export type FirmView = { firm: Firm; mcp: Mcp };

// The last good GET /api/orders stays on screen while a later poll fails.
export type OrdersState = {
	orders: Order[] | undefined;
	serverTime: string | undefined;
	error: string | undefined;
	reload: () => void;
};

export enum CopyState {
	Idle = "idle",
	Copied = "copied",
	Failed = "failed",
}
