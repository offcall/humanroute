import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AutoPayForm } from "./AutoPayForm";
import { AutoPayOn } from "./AutoPayOn";

// A real 32-byte key, so only the fee SOL decides whether Allow is enabled.
const AGENT = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const statusWith = (solLamports: number) => ({
	wallet: "Firm1111111111111111111111111111111111111111",
	mint: "Mint1111111111111111111111111111111111111111",
	payTo: "Hold1111111111111111111111111111111111111111",
	payToAccount: "HoldAta1111111111111111111111111111111111111",
	solLamports,
	blockhash: "Blockhash111111111111111111111111111111111111",
	lastValidBlockHeight: 100,
	account: "FirmAta1111111111111111111111111111111111111",
	exists: true,
	balanceUnits: 20_000_000n,
	delegate: AGENT,
	allowanceUnits: 5_000_000n,
});

const noop = (): void => {};

const buttonDisabled = (name: string): boolean => {
	const button = screen.getByRole("button", { name });
	return button instanceof HTMLButtonElement && button.disabled;
};

const faucetShown = (): boolean =>
	screen.queryByRole("link", { name: "faucet.solana.com" }) !== null;

afterEach(cleanup);

describe("WEB-02 Allow and Turn off are disabled without fee SOL (below 10000 lamports)", () => {
	it.each([
		[9_999, true],
		[10_000, false],
	])(
		"%i lamports: disabled %s, faucet link shown alike",
		(lamports, blocked) => {
			const status = statusWith(lamports);
			render(
				<AutoPayForm
					status={status}
					busy={false}
					onApprove={noop}
					onBack={noop}
				/>,
			);
			expect(buttonDisabled("Allow in Phantom")).toBe(blocked);
			expect(faucetShown()).toBe(blocked);
			cleanup();

			render(
				<AutoPayOn
					status={status}
					lastTx={undefined}
					busy={false}
					onChange={noop}
					onOff={noop}
				/>,
			);
			expect(buttonDisabled("Turn off")).toBe(blocked);
			expect(faucetShown()).toBe(blocked);
		},
	);
});
