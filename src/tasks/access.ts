// Caller identity from the session cookie or the firm's MCP Bearer token, and who may see a task.
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { TasksDeps } from "./deps.js";
import type { Claimer, Task } from "./types.js";

export const sessionWallet = (deps: TasksDeps, ctx: Context): string | null =>
	deps.lookupSession(getCookie(ctx, deps.sessionCookie));

export const bearerToken = (ctx: Context): string | null => {
	const match = /^Bearer (\S+)$/.exec(ctx.req.header("authorization") ?? "");
	const token = match?.[1];
	return token === undefined ? null : token;
};

// null: no valid credentials (401); false: authenticated but not allowed (403).
export const canView = (
	deps: TasksDeps,
	ctx: Context,
	task: Task,
): boolean | null => {
	const token = bearerToken(ctx);
	if (token !== null) {
		const firm = deps.firmByMcpToken(token);
		return firm === null ? null : firm.id === task.firmId;
	}
	const wallet = sessionWallet(deps, ctx);
	if (wallet === null) {
		return null;
	}
	if (deps.firmByWallet(wallet)?.id === task.firmId) {
		return true;
	}
	const linguist = deps.linguistByWallet(wallet);
	if (linguist !== null && linguist.linguistId === task.linguistId) {
		return true;
	}
	const agency = deps.agencyByWallet(wallet);
	return agency !== null && agency.id === task.agencyId;
};

// True when the caller (MCP Bearer or cookie) is the firm that ordered the task.
export const isOwnerFirm = (
	deps: TasksDeps,
	ctx: Context,
	task: Task,
): boolean => {
	const token = bearerToken(ctx);
	if (token !== null) {
		return deps.firmByMcpToken(token)?.id === task.firmId;
	}
	const wallet = sessionWallet(deps, ctx);
	return wallet !== null && deps.firmByWallet(wallet)?.id === task.firmId;
};

// True when the session linguist is the task's claimer; an MCP Bearer caller is a firm.
export const isClaimer = (
	deps: TasksDeps,
	ctx: Context,
	task: Task,
): boolean => {
	if (bearerToken(ctx) !== null) {
		return false;
	}
	const wallet = sessionWallet(deps, ctx);
	const linguist = wallet === null ? null : deps.linguistByWallet(wallet);
	return linguist !== null && linguist.linguistId === task.linguistId;
};

export const denied = (ctx: Context, signedIn: boolean): Response =>
	signedIn
		? ctx.json({ error: "forbidden" }, 403)
		: ctx.json({ error: "unauthorized" }, 401);

// The signed-in linguist, or the 401/403 response.
export const currentLinguist = (
	deps: TasksDeps,
	ctx: Context,
): Claimer | Response => {
	const wallet = sessionWallet(deps, ctx);
	const linguist = wallet === null ? null : deps.linguistByWallet(wallet);
	return linguist ?? denied(ctx, wallet !== null);
};
