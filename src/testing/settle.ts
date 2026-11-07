// Facilitator settle answers a test can re-attribute or hold (ADR 0036, failure table row 17).
import type { TestGateway } from "./gateway.js";
import type { TestWallet } from "./wallets.js";

// The facilitator reports `payer` as the settling wallet, as for a delegate or another wallet.
export const settleAs = (gateway: TestGateway, payer: TestWallet): void => {
	const { answer } = gateway.facilitator;
	const settle = answer.settle;
	answer.verify = async () => ({ isValid: true, payer: payer.address });
	answer.settle = async (payload, requirements) => ({
		...(await settle(payload, requirements)),
		payer: payer.address,
	});
};

// A settle that waits for release(); `started` resolves once the facilitator was called.
export const holdSettle = (gateway: TestGateway) => {
	const settle = gateway.facilitator.answer.settle;
	let release = () => {};
	let markStarted = () => {};
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});
	const started = new Promise<void>((resolve) => {
		markStarted = resolve;
	});
	gateway.facilitator.answer.settle = async (payload, requirements) => {
		markStarted();
		await released;
		return settle(payload, requirements);
	};
	return { started, release: () => release() };
};
