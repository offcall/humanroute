// Which funded firm wallet each e2e case uses, so balances and ratings never mix between cases.
export enum FirmSlot {
	Environment = 0,
	OrderPaid = 1,
	OrderDecisions = 2,
	OrderExpiry = 3,
	OrderRestart = 4,
	Mcp = 5,
	AutopayPay = 6,
	AutopayChanged = 7,
	BrowserPay = 8,
	BrowserFirm = 9,
	BrowserLinguist = 10,
	BrowserAutopay = 11,
}

export const FIRM_COUNT = Object.values(FirmSlot).filter(
	(slot) => typeof slot === "number",
).length;

// Devnet USDC units per slot: the peak each slot's cases hold at once (0.50 USDC per task,
// refunds counted back). Localnet-only and refuse-before-balance slots get 0. About 9 USDC total.
export const DEVNET_FIRM_UNITS: Record<FirmSlot, bigint> = {
	[FirmSlot.Environment]: 0n,
	[FirmSlot.OrderPaid]: 1_500_000n,
	[FirmSlot.OrderDecisions]: 500_000n,
	[FirmSlot.OrderExpiry]: 500_000n,
	[FirmSlot.OrderRestart]: 0n,
	[FirmSlot.Mcp]: 500_000n,
	[FirmSlot.AutopayPay]: 1_000_000n,
	[FirmSlot.AutopayChanged]: 500_000n,
	[FirmSlot.BrowserPay]: 2_000_000n,
	[FirmSlot.BrowserFirm]: 1_000_000n,
	[FirmSlot.BrowserLinguist]: 1_500_000n,
	[FirmSlot.BrowserAutopay]: 0n,
};
