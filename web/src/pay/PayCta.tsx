import { Icon, IconName, phantomDeepLink } from "../shared";
import { formatUsdc } from "./format";

type Props = {
	installed: boolean;
	paying: boolean;
	totalUnits: bigint;
	onPay: () => void;
};

const NoPhantom = () => (
	<>
		<div className="alert alert--info" role="status">
			<Icon name={IconName.Alarm} size={20} />
			<div>
				<b>Install Phantom to pay.</b>
				<span className="only-phone">
					{" "}
					Or open this page in the Phantom app.
				</span>
			</div>
		</div>
		<div className="pay-cta">
			<a
				className="btn btn--primary btn--lg btn--block only-desktop"
				href="https://phantom.app/download"
				target="_blank"
				rel="noreferrer"
			>
				Install Phantom
				<Icon name={IconName.Ext} size={18} />
			</a>
			<a
				className="btn btn--primary btn--lg btn--block only-phone"
				href={phantomDeepLink(window.location.href)}
			>
				Open in Phantom
			</a>
		</div>
	</>
);

// Pay pill; while paying a pulsing dot and where to confirm.
export const PayCta = ({ installed, paying, totalUnits, onPay }: Props) => {
	if (!installed) {
		return <NoPhantom />;
	}

	return (
		<div className="pay-cta">
			<button
				type="button"
				className="btn btn--primary btn--lg btn--block"
				disabled={paying}
				aria-busy={paying || undefined}
				onClick={onPay}
			>
				{paying ? <span className="dot dot--pulse" aria-hidden="true" /> : null}
				{paying ? "Paying…" : "Pay with Phantom"}
			</button>
			{paying ? (
				<p className="pay-hint" role="status">
					Confirm {formatUsdc(totalUnits)} USDC in the Phantom window. Keep this
					page open.
				</p>
			) : null}
		</div>
	);
};
