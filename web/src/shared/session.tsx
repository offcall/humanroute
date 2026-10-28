import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { request } from "./api";
import { parseMe } from "./parsers";
import { signIn as signInSiws } from "./siws";
import type { Me } from "./types";
import { getPhantom } from "./wallet";

type Session = {
	me: Me | null;
	loading: boolean;
	refresh: () => Promise<void>;
	signIn: () => Promise<string | undefined>;
};

const SessionContext = createContext<Session | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
	const [me, setMe] = useState<Me | null>(null);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		const res = await request("GET", "/api/me", undefined, parseMe);
		if (res.ok) {
			setMe(res.value);
		} else if (res.status === 401) {
			setMe(null);
		}
		setLoading(false);
	}, []);

	const signIn = useCallback(async () => {
		const phantom = getPhantom();
		if (phantom === undefined) {
			return "no_wallet";
		}
		const res = await signInSiws(phantom);
		if (!res.ok) {
			return res.error.error;
		}
		await refresh();

		return undefined;
	}, [refresh]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const value = useMemo(
		() => ({ me, loading, refresh, signIn }),
		[me, loading, refresh, signIn],
	);

	return (
		<SessionContext.Provider value={value}>{children}</SessionContext.Provider>
	);
};

export const useSession = (): Session => {
	const session = useContext(SessionContext);
	if (session === undefined) {
		throw new Error("useSession outside SessionProvider");
	}

	return session;
};
