// State sets shared by the gateway, the MCP server and the web (they cannot import src/ values).
import { describe, expect, test } from "vitest";
import * as mcp from "../mcp/types.js";
import { DraftState } from "../src/orders/index.js";
import { AutopayStatus } from "../src/orders/types.js";
import { PublicState, TaskState } from "../src/tasks/index.js";
import {
	createTestGateway,
	expectJson,
	joinLinguist,
	registerAgency,
	send,
	WALLETS,
} from "../src/testing/index.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

// web/ uses extensionless Bundler imports that the root tsc cannot check; Vitest resolves them,
// so web modules load at runtime through a non-literal specifier.
const webModule = async (file: string): Promise<Record<string, unknown>> => {
	const mod: unknown = await import(/* @vite-ignore */ `../web/src/${file}`);
	if (!isRecord(mod)) {
		throw new Error(`web/src/${file} did not load`);
	}
	return mod;
};

const values = (record: unknown): unknown[] =>
	isRecord(record) ? Object.values(record).sort() : [];

const webStatusOf = async (): Promise<
	(state: string, publicState: string) => unknown
> => {
	const statusOf = (await webModule("shared/status.ts")).statusOf;
	if (typeof statusOf !== "function") {
		throw new Error("web statusOf is missing");
	}
	return (state, publicState) => {
		const status: unknown = statusOf(state, publicState);
		return isRecord(status) ? status.tagKind : undefined;
	};
};

// The tag a task shows for each public state, whatever the task state (ADR 0033).
const TAG_OF: Record<PublicState, string> = {
	[PublicState.Open]: "open",
	[PublicState.Claimed]: "claimed",
	[PublicState.Submitted]: "submitted",
	[PublicState.PayingOut]: "paying",
	[PublicState.Refunding]: "refunding",
	[PublicState.PaidOut]: "paid",
	[PublicState.Refunded]: "refunded",
};
// The task state behind each public state on the gateway.
const NATURAL: Record<PublicState, TaskState> = {
	[PublicState.Open]: TaskState.Open,
	[PublicState.Claimed]: TaskState.Claimed,
	[PublicState.Submitted]: TaskState.Submitted,
	[PublicState.PayingOut]: TaskState.Approved,
	[PublicState.Refunding]: TaskState.Rejected,
	[PublicState.PaidOut]: TaskState.Approved,
	[PublicState.Refunded]: TaskState.ExpiredLate,
};

describe("shared state sets match across processes", () => {
	test("src and mcp PublicState and AutopayStatus are equal", () => {
		expect(values(mcp.PublicState)).toEqual(values(PublicState));
		expect(values(mcp.AutopayStatus)).toEqual(values(AutopayStatus));
	});

	test("src and web TaskState are equal", async () => {
		const web = await webModule("shared/types.ts");
		expect(values(web.TaskState)).toEqual(values(TaskState));
	});

	test("src, mcp and web DraftState are equal", async () => {
		const web = await webModule("pay/types.ts");
		expect(values(mcp.DraftState)).toEqual(values(DraftState));
		expect(values(web.DraftState)).toEqual(values(DraftState));
	});

	test("web statusOf maps every PublicState of its natural task state", async () => {
		const tagOf = await webStatusOf();
		for (const publicState of Object.values(PublicState)) {
			expect(tagOf(NATURAL[publicState], publicState), publicState).toBe(
				TAG_OF[publicState],
			);
		}
	});

	// open, claimed and submitted fall through to the task-state switch in web/src/shared/status.ts,
	// so a publicState that disagrees with the state shows the state's tag (lane WEB).
	test("web statusOf maps every PublicState explicitly, not through the fallback", async () => {
		const tagOf = await webStatusOf();
		for (const publicState of Object.values(PublicState)) {
			for (const state of Object.values(TaskState)) {
				expect(tagOf(state, publicState), `${state}/${publicState}`).toBe(
					TAG_OF[publicState],
				);
			}
		}
	});

	test("web Language is a subset of the gateway's /^[a-z]{2}$/ codes, which also takes unlisted ones", async () => {
		const web = await webModule("shared/types.ts");
		const languages = values(web.Language);
		expect(languages).toEqual(["de", "en", "es", "fr", "it", "pt", "ru"]);
		for (const code of languages) {
			expect(code).toMatch(/^[a-z]{2}$/);
		}

		// Characterized: the gateway takes any two-letter code, also ones the web cannot name.
		const { app } = createTestGateway();
		const agency = await registerAgency(app, WALLETS.agency);
		const cookie = await joinLinguist(
			app,
			WALLETS.linguist,
			agency.inviteCode,
			[{ source: "en", target: "es" }],
		);
		const unlisted = { pairs: [{ source: "zz", target: "en" }] };
		const res = await send(app, "PUT", "/api/linguist/languages", {
			cookie,
			body: unlisted,
		});
		expect(await expectJson(res, 200)).toEqual(unlisted);
	});
});
