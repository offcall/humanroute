import type { ReactNode } from "react";
import { useSession } from "./session";
import { WalletButton } from "./WalletButton";

// Session check: loading skeleton, then sign-in, then the page.
export const RequireSession = ({ children }: { children: ReactNode }) => {
	const { me, loading } = useSession();

	if (loading) {
		return (
			<div className="stack" aria-busy="true">
				<p className="visually-hidden" role="status">
					Loading…
				</p>
				<div className="skeleton skeleton--title" />
				<div className="skeleton skeleton--block" />
			</div>
		);
	}
	if (me === null) {
		return <WalletButton />;
	}

	return <>{children}</>;
};
