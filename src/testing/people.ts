// The three roles through the same routes the cabinets use (ADR 0020, 0021).
import type { Hono } from "hono";
import { expectJson, objectField, send, textField } from "./http.js";
import { signIn } from "./session.js";
import type { TestWallet } from "./wallets.js";

export type TestFirm = { cookie: string; firmId: string; mcpToken: string };
export type TestAgency = {
	cookie: string;
	agencyId: string;
	inviteCode: string;
};
export type LanguagePair = { source: string; target: string };

export const registerFirm = async (
	app: Hono,
	wallet: TestWallet,
): Promise<TestFirm> => {
	const cookie = await signIn(app, wallet);
	const body = { name: "MedSafe-Rx" };
	const created = await expectJson(
		await send(app, "POST", "/api/firm", { cookie, body }),
		201,
	);

	return {
		cookie,
		firmId: textField(objectField(created, "firm"), "id"),
		mcpToken: textField(objectField(created, "mcp"), "token"),
	};
};

export const registerAgency = async (
	app: Hono,
	wallet: TestWallet,
): Promise<TestAgency> => {
	const cookie = await signIn(app, wallet);
	const body = { name: "Nairobi Lingua" };
	const created = await expectJson(
		await send(app, "POST", "/api/agency", { cookie, body }),
		201,
	);
	const invite = await expectJson(
		await send(app, "POST", "/api/agency/invite", { cookie, body: {} }),
		200,
	);

	return {
		cookie,
		agencyId: textField(objectField(created, "agency"), "id"),
		inviteCode: textField(invite, "code"),
	};
};

// Joins the agency by its invite and sets the pairs; returns the linguist's Cookie header.
export const joinLinguist = async (
	app: Hono,
	wallet: TestWallet,
	inviteCode: string,
	pairs: LanguagePair[],
): Promise<string> => {
	const cookie = await signIn(app, wallet);
	const joinPath = `/api/linguist/join/${inviteCode}`;
	await expectJson(
		await send(app, "POST", joinPath, { cookie, body: {} }),
		200,
	);
	await expectJson(
		await send(app, "PUT", "/api/linguist/languages", {
			cookie,
			body: { pairs },
		}),
		200,
	);

	return cookie;
};
