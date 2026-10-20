// Gateway and inbox URLs from GATEWAY_URL and INBOX_TOKEN.
export const gatewayUrl = (): string => {
	const raw = process.env.GATEWAY_URL || "http://localhost:4021";
	const url = new URL(raw);
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(`GATEWAY_URL must be http(s): ${raw}`);
	}
	return url.toString().replace(/\/$/, "");
};

export const inboxUrl = (gateway: string): string => {
	const token = process.env.INBOX_TOKEN;
	return token
		? `${gateway}/inbox/${encodeURIComponent(token)}`
		: "(set INBOX_TOKEN to print the inbox URL)";
};
