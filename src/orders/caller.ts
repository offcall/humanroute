// Firm of the caller: MCP Bearer token or session cookie (api.md).
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { OrdersDeps } from "./types.js";

export type Caller =
	| { kind: "firm"; firmId: string }
	| { kind: "other" }
	| { kind: "anonymous" };

export const bearerFirm = (deps: OrdersDeps, ctx: Context): Caller => {
	const match = /^Bearer (\S+)$/.exec(ctx.req.header("authorization") ?? "");
	const token = match?.[1];
	if (token === undefined) {
		return { kind: "anonymous" };
	}
	const firm = deps.firmByMcpToken(token);
	return firm ? { kind: "firm", firmId: firm.id } : { kind: "anonymous" };
};

export const cookieFirm = (deps: OrdersDeps, ctx: Context): Caller => {
	const wallet = deps.lookupSession(getCookie(ctx, deps.sessionCookie));
	if (wallet === null) {
		return { kind: "anonymous" };
	}
	const firm = deps.firmByWallet(wallet);
	return firm ? { kind: "firm", firmId: firm.id } : { kind: "other" };
};

export const denied = (ctx: Context, caller: Caller): Response =>
	caller.kind === "anonymous"
		? ctx.json({ error: "unauthorized" }, 401)
		: ctx.json({ error: "forbidden" }, 403);
