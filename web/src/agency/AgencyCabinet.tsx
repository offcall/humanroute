import { useCallback, useEffect, useState } from "react";
import {
	type Agency as AgencyAccount,
	isRecord,
	orNull,
	parseAgency,
	RequireSession,
	request,
	str,
	useSession,
} from "../shared";
import { AgencyRating } from "./AgencyRating";
import { InviteLink } from "./InviteLink";
import { RegisterAgency } from "./RegisterAgency";

type AgencyView = { agency: AgencyAccount; inviteUrl: string | null };

type Load =
	| { kind: "loading" }
	| { kind: "missing" }
	| { kind: "error"; message: string }
	| { kind: "ready"; view: AgencyView };

const parseAgencyView = (raw: unknown): AgencyView | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const agency = parseAgency(raw.agency);
	const inviteUrl = orNull(raw.inviteUrl, str);
	if (agency === undefined || inviteUrl === undefined) {
		return undefined;
	}

	return { agency, inviteUrl };
};

const AgencyCabinet = () => {
	const { me } = useSession();
	const [load, setLoad] = useState<Load>({ kind: "loading" });

	const fetchAgency = useCallback(async () => {
		const res = await request("GET", "/api/agency", undefined, parseAgencyView);
		if (res.ok) {
			setLoad({ kind: "ready", view: res.value });
		} else if (res.status === 404) {
			setLoad({ kind: "missing" });
		} else {
			setLoad({ kind: "error", message: res.error.error });
		}
	}, []);

	useEffect(() => {
		void fetchAgency();
	}, [fetchAgency]);

	if (load.kind === "loading") {
		return <p>Loading…</p>;
	}
	if (load.kind === "error") {
		return <p className="error">Could not load agency: {load.message}</p>;
	}
	if (load.kind === "missing") {
		return <RegisterAgency onDone={fetchAgency} />;
	}

	const agencyId = me?.agency?.id;

	return (
		<section>
			<h1>{load.view.agency.name}</h1>
			<InviteLink initialUrl={load.view.inviteUrl} />
			{agencyId === undefined ? null : <AgencyRating agencyId={agencyId} />}
		</section>
	);
};

export const Agency = () => (
	<RequireSession>
		<AgencyCabinet />
	</RequireSession>
);
