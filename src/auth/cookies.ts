// Cookie options for the session (ADR 0020) and the login request secret (ADR 0034).
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import {
	type AuthDeps,
	LOGIN_COOKIE,
	LOGIN_PATH,
	LOGIN_TTL_SECONDS,
	SESSION_COOKIE,
} from "./types.js";

const secure = (deps: AuthDeps): boolean =>
	deps.publicBaseUrl.startsWith("https:");

export const setSessionCookie = (
	ctx: Context,
	deps: AuthDeps,
	token: string,
): void => {
	setCookie(ctx, SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: "Lax",
		path: "/",
		secure: secure(deps),
		maxAge: deps.sessionTtlSeconds,
	});
};

export const setLoginCookie = (
	ctx: Context,
	deps: AuthDeps,
	secret: string,
): void => {
	setCookie(ctx, LOGIN_COOKIE, secret, {
		httpOnly: true,
		sameSite: "Lax",
		path: LOGIN_PATH,
		secure: secure(deps),
		maxAge: LOGIN_TTL_SECONDS,
	});
};

export const clearLoginCookie = (ctx: Context, deps: AuthDeps): void => {
	deleteCookie(ctx, LOGIN_COOKIE, { path: LOGIN_PATH, secure: secure(deps) });
};
