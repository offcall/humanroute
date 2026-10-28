// Registers the firm, the agency (with an invite) and the linguist (languages en->es, en->fr).
import { call, type Jar, recordField, stringField } from "./http.js";

export type Accounts = { firmId: string; mcpToken: string; agencyId: string };

type Sessions = { firm: Jar; agency: Jar; linguist: Jar };

export const registerAccounts = async (
	gateway: string,
	jars: Sessions,
): Promise<Accounts> => {
	await call(gateway, "POST", "/api/firm", "firm", {
		jar: jars.firm,
		body: { name: "E2E firm" },
	});
	const firm = await call(gateway, "GET", "/api/firm", "firm read", {
		jar: jars.firm,
	});

	await call(gateway, "POST", "/api/agency", "agency", {
		jar: jars.agency,
		body: { name: "E2E agency" },
	});
	const agency = await call(gateway, "GET", "/api/agency", "agency read", {
		jar: jars.agency,
	});
	const invite = await call(gateway, "POST", "/api/agency/invite", "invite", {
		jar: jars.agency,
		body: {},
	});

	const code = stringField(invite, "code");
	await call(gateway, "POST", `/api/linguist/join/${code}`, "join", {
		jar: jars.linguist,
		body: {},
	});
	await call(gateway, "PUT", "/api/linguist/languages", "languages", {
		jar: jars.linguist,
		body: {
			pairs: [
				{ source: "en", target: "es" },
				{ source: "en", target: "fr" },
			],
		},
	});

	return {
		firmId: stringField(recordField(firm, "firm"), "id"),
		mcpToken: stringField(recordField(firm, "mcp"), "token"),
		agencyId: stringField(recordField(agency, "agency"), "id"),
	};
};
