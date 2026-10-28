import type { ReactNode } from "react";
import { useSession } from "./session";
import { WalletButton } from "./WalletButton";

export const RequireSession = ({ children }: { children: ReactNode }) => {
	const { me, loading } = useSession();

	if (loading) {
		return <p>Loading…</p>;
	}
	if (me === null) {
		return <WalletButton />;
	}

	return <>{children}</>;
};
