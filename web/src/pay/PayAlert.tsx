import { Icon, IconName, shortWallet } from "../shared";
import { CopyButton } from "./CopyButton";
import { FirmLink } from "./FirmLink";
import { type Failure, failureOf, Next } from "./failure";
import { formatUsdc } from "./format";
import type { DraftView } from "./types";

type Props = { message: string; draft: DraftView; payer: string | undefined };

const Action = ({
	failure,
	draftId,
}: {
	failure: Failure;
	draftId: string;
}) => {
	switch (failure.next) {
		case Next.Reload:
			return (
				<button
					type="button"
					className="btn btn--primary btn--sm"
					onClick={() => window.location.reload()}
				>
					<Icon name={IconName.Refresh} size={18} />
					Reload
				</button>
			);
		case Next.FirmCabinet:
			return <FirmLink small />;
		case Next.CopyDraft:
			return <CopyButton value={draftId} label="Copy draft id" />;
		case Next.Retry:
			return null;
	}
};

// Orphan payment: no order, so the only proof is the paying wallet's page.
const OrphanProof = ({ draft, payer }: { draft: DraftView; payer: string }) => (
	<>
		<p className="pay-orphan-proof">
			Send support the draft id{" "}
			<code className="code-chip">{draft.draftId}</code> and the paying wallet{" "}
			<code className="code-chip">{shortWallet(payer)}</code>. The transfer of{" "}
			{formatUsdc(draft.totalUnits)} USDC is listed on the wallet's page:
		</p>
		<a
			className="proof proof--lg pay-explorer"
			href={`https://explorer.solana.com/address/${payer}?cluster=devnet`}
			target="_blank"
			rel="noreferrer"
		>
			Paying wallet {shortWallet(payer)} on Solana Explorer (devnet)
			<Icon name={IconName.Ext} size={15} />
		</a>
	</>
);

export const PayAlert = ({ message, draft, payer }: Props) => {
	const failure = failureOf(message);
	const tone = failure.info ? "alert alert--info" : "alert alert--error";
	const action =
		failure.next === Next.Retry ? null : (
			<div className="alert__actions">
				<Action failure={failure} draftId={draft.draftId} />
			</div>
		);

	return (
		<>
			<div className={tone} role={failure.info ? "status" : "alert"}>
				<Icon name={failure.icon} size={20} />
				<div>
					<b>{failure.title}</b>
					<code className="pay-raw">{message}</code>
					{action}
				</div>
			</div>
			{failure.next === Next.CopyDraft && payer !== undefined ? (
				<OrphanProof draft={draft} payer={payer} />
			) : null}
		</>
	);
};

// Pay again only where nothing settled.
export const canRetry = (message: string): boolean =>
	failureOf(message).next === Next.Retry;
