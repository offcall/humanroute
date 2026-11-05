import { Icon, IconName, phantomDeepLink } from "../shared";
import { Failure, type LandError } from "./useRegister";

const detail = ({ kind, code }: LandError): string => {
	if (kind === Failure.NoWallet) {
		return "Phantom is not in this browser. Open this page in the Phantom app to sign in.";
	}
	if (kind === Failure.Register) {
		return "The firm was not created. Your wallet is signed in; press Register firm again.";
	}
	if (code.startsWith("connect_failed")) {
		return "Phantom did not connect. Unlock Phantom, then try again.";
	}

	return "Phantom did not sign the message. Press Register firm or Register agency to try again.";
};

export const LandAlert = ({ error }: { error: LandError }) => (
	<div className="alert alert--error" role="alert">
		<Icon name={IconName.Alarm} size={20} />
		<div>
			<b>Error: {error.code}</b>
			<br />
			{detail(error)}
		</div>
		{error.kind === Failure.NoWallet ? (
			<div className="alert__actions">
				<a
					className="btn btn--primary land-btn"
					href={phantomDeepLink(window.location.href)}
				>
					Open in Phantom
				</a>
			</div>
		) : null}
	</div>
);
