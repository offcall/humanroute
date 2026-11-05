import { shortWallet } from "../shared";
import { Busy } from "./useRegister";

export const statusText = (busy: Busy, firmName: string): string => {
	if (busy === Busy.SignFirm) {
		return `Sign the message in Phantom to register ${firmName}. No transaction, no fee.`;
	}
	if (busy === Busy.SignAgency) {
		return "Sign the message in Phantom to open your agency. No transaction, no fee.";
	}

	return `Registering ${firmName}. You are signed in, so Phantom does not ask again.`;
};

export const hintText = (busy: Busy, wallet: string | undefined): string => {
	const rest =
		"Agencies register here too; linguists join through their agency's invite link.";
	if (busy !== Busy.Idle) {
		return rest;
	}

	return wallet === undefined
		? `You sign one message in Phantom. ${rest}`
		: `Signed in as ${shortWallet(wallet)}. ${rest}`;
};
