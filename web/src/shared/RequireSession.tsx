import type { ReactNode } from "react";
import { PageLoading } from "./PageLoading";
import { useSession } from "./session";
import { WalletButton } from "./WalletButton";

// Session check: full-screen loader, then sign-in, then the page.
export const RequireSession = ({ children }: { children: ReactNode }) => {
	const { me, loading } = useSession();

	if (loading) {
		return <PageLoading />;
	}
	if (me === null) {
		return <WalletButton />;
	}

	return <>{children}</>;
};
