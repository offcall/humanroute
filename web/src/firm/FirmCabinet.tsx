import { useEffect, useState } from "react";
import {
	type ApiResult,
	type Firm,
	isRecord,
	navigate,
	parseFirm,
	RequireSession,
	request,
	str,
} from "../shared";
import { FirmRating } from "./FirmRating";
import { type Mcp, McpConnection } from "./McpConnection";
import { OrderList } from "./OrderList";

type FirmView = { firm: Firm; mcp: Mcp };

const parseFirmView = (raw: unknown): FirmView | undefined => {
	if (!isRecord(raw) || !isRecord(raw.mcp)) {
		return undefined;
	}
	const firm = parseFirm(raw.firm);
	const url = str(raw.mcp.url);
	const token = str(raw.mcp.token);
	if (firm === undefined || url === undefined || token === undefined) {
		return undefined;
	}

	return { firm, mcp: { url, token } };
};

const goHome = (event: React.MouseEvent) => {
	event.preventDefault();
	navigate("/");
};

const FirmBody = () => {
	const [res, setRes] = useState<ApiResult<FirmView> | undefined>(undefined);

	useEffect(() => {
		void request("GET", "/api/firm", undefined, parseFirmView).then(setRes);
	}, []);

	if (res === undefined) {
		return <p>Loading…</p>;
	}
	if (!res.ok && res.status === 404) {
		return (
			<p>
				No firm yet.{" "}
				<a href="/" onClick={goHome}>
					Register firm
				</a>
			</p>
		);
	}
	if (!res.ok) {
		return <p className="error">{res.error.message ?? res.error.error}</p>;
	}

	return (
		<>
			<h2>{res.value.firm.name}</h2>
			<FirmRating firmId={res.value.firm.id} />
			<McpConnection mcp={res.value.mcp} />
			<OrderList />
		</>
	);
};

export const FirmCabinet = () => (
	<>
		<h1>Firm cabinet</h1>
		<RequireSession>
			<FirmBody />
		</RequireSession>
	</>
);
