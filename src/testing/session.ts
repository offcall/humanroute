// SIWS sign-in as the web does it (ADR 0020): nonce, sign the server's text, verify.
import type { Hono } from "hono";
import { SESSION_COOKIE } from "../auth/index.js";
import { expectJson, send, textField } from "./http.js";
import type { TestWallet } from "./wallets.js";

// Returns the Cookie header value of the new session, "hr_session=...".
export const signIn = async (
	app: Hono,
	wallet: TestWallet,
): Promise<string> => {
	const nonceBody = { wallet: wallet.address };
	const challenge = await expectJson(
		await send(app, "POST", "/api/auth/nonce", { body: nonceBody }),
		200,
	);
	const signature = wallet.signText(textField(challenge, "message"));
	const nonce = textField(challenge, "nonce");
	const verifyBody = { wallet: wallet.address, nonce, signature };
	const res = await send(app, "POST", "/api/auth/verify", { body: verifyBody });
	await expectJson(res, 200);

	const line = res.headers
		.getSetCookie()
		.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
	if (line === undefined) {
		throw new Error("sign-in set no session cookie");
	}
	const end = line.indexOf(";");

	return end === -1 ? line : line.slice(0, end);
};
