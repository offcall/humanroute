// Status token = HMAC-SHA256(STATUS_SECRET, jobId) hex. Nothing to store; verified in constant time.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Accepted } from "./types.js";

export const statusToken = (secret: string, jobId: string): string =>
	createHmac("sha256", secret).update(jobId).digest("hex");

export const statusTokenValid = (
	secret: string,
	jobId: string,
	given: string | undefined,
): boolean => {
	if (!given) {
		return false;
	}
	const expected = Buffer.from(statusToken(secret, jobId));
	const actual = Buffer.from(given);
	return expected.length === actual.length && timingSafeEqual(expected, actual);
};

export const accepted = (secret: string, jobId: string): Accepted => {
	const token = statusToken(secret, jobId);
	return {
		jobId,
		statusUrl: `/jobs/${jobId}?token=${token}`,
		statusToken: token,
	};
};
