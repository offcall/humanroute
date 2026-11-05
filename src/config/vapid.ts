// VAPID keys for Web Push (ADR 0029): all three or none. None turns push off.
import type { Vapid } from "./types.js";

type Get = (name: string) => string;

const NAMES = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
const BASE64URL = /^[A-Za-z0-9_-]+$/;

// Public key: uncompressed P-256 point (65 bytes, 0x04 first). Private key: 32 bytes.
const keyBytes = (raw: string): Buffer | null =>
	BASE64URL.test(raw) ? Buffer.from(raw, "base64url") : null;

const isSubject = (raw: string): boolean => {
	try {
		const url = new URL(raw);
		return url.protocol === "mailto:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

export const parseVapid = (
	rawEnv: Get,
	fail: (message: string) => void,
): Vapid | null => {
	const [publicKey = "", privateKey = "", subject = ""] = NAMES.map(rawEnv);
	const given = [publicKey, privateKey, subject].filter((raw) => raw !== "");
	if (given.length === 0) {
		return null;
	}
	if (given.length !== NAMES.length) {
		fail(`${NAMES.join(", ")} must be set together or all left empty`);
		return null;
	}

	const publicBytes = keyBytes(publicKey);
	const privateBytes = keyBytes(privateKey);
	const problems = [
		publicBytes?.length === 65 && publicBytes[0] === 4
			? null
			: "VAPID_PUBLIC_KEY must be a base64url P-256 public key (65 bytes)",
		privateBytes?.length === 32
			? null
			: "VAPID_PRIVATE_KEY must be a base64url P-256 private key (32 bytes)",
		isSubject(subject)
			? null
			: `VAPID_SUBJECT must be a mailto: or https: URL, got "${subject}"`,
	].filter((problem) => problem !== null);
	for (const problem of problems) {
		fail(problem);
	}

	return problems.length === 0 ? { publicKey, privateKey, subject } : null;
};
