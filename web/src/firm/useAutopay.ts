// Reads the firm's allowance from chain and sends approve or revoke through Phantom.
import type { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { request } from "../shared";
import { type Autopay, parseAutopay } from "./autopayParse";
import { sendWithPhantom } from "./phantomSend";

const CONFIRM_WAIT_MS = 4000;

export const useAutopay = () => {
	const [status, setStatus] = useState<Autopay | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | undefined>(undefined);
	const [lastTx, setLastTx] = useState<string | undefined>(undefined);

	const load = useCallback(async () => {
		const res = await request(
			"GET",
			"/api/firm/autopay",
			undefined,
			parseAutopay,
		);
		setStatus(res.ok ? res.value : undefined);
		setNote(
			res.ok
				? undefined
				: "Could not read your USDC account from devnet; try again.",
		);
	}, []);
	useEffect(() => void load(), [load]);

	const run = async (build: (current: Autopay) => VersionedTransaction) => {
		if (status === undefined) {
			return;
		}
		setBusy(true);
		setNote(undefined);
		const sent = await sendWithPhantom(status.wallet, build(status));
		setBusy(false);
		if (!sent.ok) {
			setNote(sent.error);
			return;
		}
		setLastTx(sent.signature);
		setNote("Sent. The new allowance shows once devnet confirms it.");
		setTimeout(() => void load(), CONFIRM_WAIT_MS);
	};

	return { status, busy, note, lastTx, run };
};
