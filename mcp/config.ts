import type { Parsed } from "./types.js";

export type McpConfig = { gatewayUrl: string; port: number };

const DEFAULT_PORT = 4022;

export const loadConfig = (env: NodeJS.ProcessEnv): Parsed<McpConfig> => {
	const rawUrl = env.GATEWAY_URL;
	if (rawUrl === undefined || rawUrl === "") {
		return { ok: false, error: "GATEWAY_URL is required" };
	}
	if (!URL.canParse(rawUrl) || !/^https?:\/\//.test(rawUrl)) {
		return { ok: false, error: "GATEWAY_URL must be an absolute http(s) URL" };
	}
	const gatewayUrl = rawUrl.replace(/\/+$/, "");

	const rawPort = env.MCP_PORT;
	if (rawPort === undefined || rawPort === "") {
		return { ok: true, value: { gatewayUrl, port: DEFAULT_PORT } };
	}
	const port = Number(rawPort);
	if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
		return { ok: false, error: "MCP_PORT must be an integer 1-65535" };
	}

	return { ok: true, value: { gatewayUrl, port } };
};
