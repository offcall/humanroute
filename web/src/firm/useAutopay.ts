// Reads the firm's allowance from chain and sends approve or revoke through Phantom.
import type { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { request } from "../shared";
import { type Autopay, parseAutopay } from "./autopayParse";
import { sendWithPhantom } from "./phantomSend";

const CONFIRM_WAIT_MS = 4000;
const READ_FAILED = "Could not read your USDC account from devnet; try again.";

const readStatus = async (): Promise<Autopay | undefined> => {
	const res = await request(
		"GET",
		"/api/firm/autopay",
		undefined,
		parseAutopay,
	);
	return res.ok ? res.value : undefined;
};

export const useAutopay = () => {
	const [status, setStatus] = useState<Autopay | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | undefined>(undefined);
	const [lastTx, setLastTx] = useState<string | undefined>(undefined);

	const load = useCallback(async () => {
		const current = await readStatus();
		setStatus(current);
		setNote(current === undefined ? READ_FAILED : undefined);
		return current;
	}, []);
	useEffect(() => void load(), [load]);

	// A blockhash lives about a minute; the page may have been open longer, so read a fresh one.
	const run = async (build: (current: Autopay) => VersionedTransaction) => {
		setBusy(true);
		setNote(undefined);
		const fresh = await load();
		if (fresh === undefined) {
			setBusy(false);
			return;
		}
		const sent = await sendWithPhantom(fresh.wallet, build(fresh));
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
