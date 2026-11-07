// Second safety net before a resend (ADR 0006, ADR 0039): a successful hold transaction that
// already carries the memo, searched page by page back to the transfer's creation time.
import type {
	ConfirmedSignatureInfo,
	Connection,
	PublicKey,
} from "@solana/web3.js";
import { classify } from "./errors.js";
import { type ChainResult, type MemoSearch, Phase } from "./types.js";

const PAGE_LIMIT = 1_000;
const MAX_PAGES = 10;
// Margin for clock skew between the gateway and block times.
const SKEW_SECONDS = 600;

const carries = (info: ConfirmedSignatureInfo, memo: string): boolean =>
	info.err === null && info.memo !== null && info.memo.includes(memo);

// Null block times are searched but never prove that the window is covered.
const reaches = (info: ConfirmedSignatureInfo, floor: number): boolean =>
	typeof info.blockTime === "number" && info.blockTime < floor;

export const findMemo = async (
	conn: Connection,
	hold: PublicKey,
	memo: string,
	since: number,
): Promise<ChainResult<MemoSearch>> => {
	const floor = since / 1000 - SKEW_SECONDS;
	let before: string | null = null;
	try {
		for (let page = 0; page < MAX_PAGES; page += 1) {
			const options =
				before === null ? { limit: PAGE_LIMIT } : { limit: PAGE_LIMIT, before };
			const sigs = await conn.getSignaturesForAddress(
				hold,
				options,
				"confirmed",
			);
			const hit = sigs.find((info) => carries(info, memo));
			if (hit) {
				return {
					ok: true,
					value: { state: "found", signature: hit.signature },
				};
			}
			if (sigs.some((info) => reaches(info, floor))) {
				return { ok: true, value: { state: "absent" } };
			}
			const last = sigs.at(-1);
			if (sigs.length < PAGE_LIMIT || last === undefined) {
				return { ok: true, value: { state: "uncovered" } };
			}
			before = last.signature;
		}
		return { ok: true, value: { state: "uncovered" } };
	} catch (err) {
		return { ok: false, error: classify(err, Phase.Prepare) };
	}
};
