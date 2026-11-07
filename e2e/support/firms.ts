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
}
