// Which funded firm wallet each e2e case uses, so balances and ratings never mix between cases.
export enum FirmSlot {
	Environment = 0,
	OrderPaid = 1,
	OrderDecisions = 2,
	OrderReplay = 3,
	OrderExpiry = 4,
	OrderRatings = 5,
	OrderRestart = 6,
	Mcp = 7,
	AutopayPay = 8,
	AutopayRefusals = 9,
	AutopayChanged = 10,
	BrowserPay = 11,
	BrowserFirm = 12,
	BrowserLinguist = 13,
	BrowserAutopay = 14,
	BrowserUnknown = 15,
	McpAccess = 16,
}

export const FIRM_COUNT = Object.values(FirmSlot).filter(
	(slot) => typeof slot === "number",
).length;

// Devnet USDC units per slot: the peak each slot's cases hold at once (0.50 USDC per task,
// refunds counted back). Localnet-only and refuse-before-balance slots get 0. About 15 USDC total.
export const DEVNET_FIRM_UNITS: Record<FirmSlot, bigint> = {
	[FirmSlot.Environment]: 0n,
	[FirmSlot.OrderPaid]: 1_500_000n,
	[FirmSlot.OrderDecisions]: 1_000_000n,
	[FirmSlot.OrderReplay]: 1_000_000n,
	[FirmSlot.OrderExpiry]: 1_000_000n,
	[FirmSlot.OrderRatings]: 1_000_000n,
	[FirmSlot.OrderRestart]: 0n,
	[FirmSlot.Mcp]: 2_000_000n,
	[FirmSlot.AutopayPay]: 1_500_000n,
	[FirmSlot.AutopayRefusals]: 0n,
	[FirmSlot.AutopayChanged]: 500_000n,
	[FirmSlot.BrowserPay]: 1_500_000n,
	[FirmSlot.BrowserFirm]: 1_000_000n,
	[FirmSlot.BrowserLinguist]: 1_500_000n,
	[FirmSlot.BrowserAutopay]: 0n,
	[FirmSlot.BrowserUnknown]: 1_000_000n,
	[FirmSlot.McpAccess]: 500_000n,
};
