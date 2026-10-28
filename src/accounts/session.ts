import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { type AccountsDeps, SESSION_COOKIE } from "./types.js";

export const sessionWallet = (
	deps: AccountsDeps,
	ctx: Context,
): string | null => deps.lookupSession(getCookie(ctx, SESSION_COOKIE));

export const unauthorized = (ctx: Context): Response =>
	ctx.json({ error: "unauthorized" }, 401);
export const malformed = (ctx: Context): Response =>
	ctx.json({ error: "malformed_body" }, 400);
export const invalid = (ctx: Context): Response =>
	ctx.json({ error: "invalid_body" }, 422);
export const failure = (
	ctx: Context,
	status: 403 | 404 | 409,
	error: string,
): Response => ctx.json({ error }, status);
