import { useCallback, useEffect, useState } from "react";
import {
	type Agency as AgencyAccount,
	Icon,
	IconName,
	isRecord,
	orNull,
	parseAgency,
	request,
	str,
} from "../shared";
import { AgencyPlate } from "./AgencyPlate";
import { AgencyRating } from "./AgencyRating";
import { InviteLink } from "./InviteLink";
import { Loading } from "./Loading";
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

type Props = { wallet: string; agencyId: string | undefined };

export const AgencyCabinet = ({ wallet, agencyId }: Props) => {
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
		return (
			<main className="ag-main" aria-busy="true">
				<Loading />
			</main>
		);
	}
	if (load.kind === "missing") {
		return <RegisterAgency wallet={wallet} onDone={fetchAgency} />;
	}

	return (
		<main className="ag-main">
			{load.kind === "error" ? (
				<div className="alert alert--error" role="alert">
					<Icon name={IconName.Alarm} size={20} />
					<div>
						<b>Could not load agency: {load.message}</b>
						<br />
						Your wallet is signed in, but the agency did not load. Reload the
						page to try again.
					</div>
				</div>
			) : (
				<>
					<AgencyPlate name={load.view.agency.name} wallet={wallet} />
					<InviteLink
						initialUrl={load.view.inviteUrl}
						agencyName={load.view.agency.name}
					/>
					{agencyId === undefined ? null : (
						<AgencyRating agencyId={agencyId} wallet={wallet} />
					)}
				</>
			)}
		</main>
	);
};
