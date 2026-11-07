// Reads the firm's allowance from chain and sends approve or revoke through Phantom.
import type { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { request } from "../shared";
import { type Autopay, parseAutopay } from "./autopayParse";
import { sendWithPhantom } from "./phantomSend";

const READ_FAILED = "Could not read your USDC account from devnet; try again.";
const WAITING = "Sent. Waiting for devnet to confirm it…";
const NOT_CONFIRMED =
	"Devnet has not confirmed it yet; reload the page in a minute to see the new state.";

const readStatus = async (): Promise<Autopay | undefined> => {
	const res = await request(
		"GET",
		"/api/firm/autopay",
		undefined,
		parseAutopay,
	);
	return res.ok ? res.value : undefined;
};

// The gateway answers once the transaction reaches its commitment (ADR 0045).
const confirmSent = (signature: string) =>
	request("POST", "/api/firm/autopay/confirm", { signature }, parseAutopay);

export const isAutopayOn = (status: Autopay | undefined): boolean =>
	status !== undefined &&
	status.delegate !== null &&
	status.allowanceUnits > 0n;

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
	const run = async (
		build: (current: Autopay) => VersionedTransaction,
	): Promise<boolean> => {
		setBusy(true);
		setNote(undefined);
		const fresh = await load();
		if (fresh === undefined) {
			setBusy(false);
			return false;
		}
		const sent = await sendWithPhantom(fresh.wallet, build(fresh));
		if (!sent.ok) {
			setBusy(false);
			setNote(sent.error);
			return false;
		}
		setLastTx(sent.signature);
		setNote(WAITING);
		const confirmed = await confirmSent(sent.signature);
		setBusy(false);
		if (confirmed.ok) {
			setStatus(confirmed.value);
			setNote(undefined);
			return true;
		}
		const { error, message } = confirmed.error;
		setNote(
			error === "tx_failed"
				? `The transaction failed on devnet: ${message ?? "no reason given"}.`
				: NOT_CONFIRMED,
		);
		return error !== "tx_failed";
	};

	return { status, busy, note, lastTx, run };
};

export type AutopayControl = ReturnType<typeof useAutopay>;
