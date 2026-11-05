import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { systemClock } from "./clock.js";
import { loadConfig } from "./config.js";
import { SERVER_INSTRUCTIONS } from "./descriptions.js";
import { createGatewayClient } from "./gateway.js";
import { createPayClient } from "./payGateway.js";
import { registerPayTools } from "./payTools.js";
import { registerTools } from "./tools.js";

const MAX_BODY_BYTES = 1_048_576;

const logError = (error: unknown) => {
	console.error(
		"mcp: request failed",
		error instanceof Error ? error.message : error,
	);
};

const config = loadConfig(process.env);
if (!config.ok) {
	console.error(`mcp: ${config.error}`);
	process.exit(1);
}
const client = createGatewayClient(config.value.gatewayUrl);
const payClient = createPayClient(config.value.gatewayUrl);

const parseBearer = (header: string | undefined): string | undefined => {
	const match = /^Bearer (\S+)$/.exec(header ?? "");

	return match?.[1];
};

const readBody = async (req: AsyncIterable<unknown>): Promise<unknown> => {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		if (!Buffer.isBuffer(chunk)) {
			throw new Error("unexpected chunk");
		}
		size += chunk.length;
		if (size > MAX_BODY_BYTES) {
			throw new Error("body too large");
		}
		chunks.push(chunk);
	}

	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const server = createServer(async (req, res) => {
	const sendJson = (status: number, body: unknown) => {
		res.writeHead(status, { "content-type": "application/json" });
		res.end(JSON.stringify(body));
	};

	if (req.url !== "/mcp") {
		sendJson(404, { error: "not_found" });
		return;
	}
	if (req.method !== "POST") {
		res.setHeader("allow", "POST");
		sendJson(405, { error: "method_not_allowed" });
		return;
	}
	const token = parseBearer(req.headers.authorization);
	if (token === undefined) {
		sendJson(401, { error: "unauthorized" });
		return;
	}

	let body: unknown;
	try {
		body = await readBody(req);
	} catch {
		sendJson(400, { error: "bad_request" });
		return;
	}
	try {
		const mcp = new McpServer(
			{ name: "humanroute", version: "2.0.0" },
			{ instructions: SERVER_INSTRUCTIONS },
		);
		registerTools(mcp, token, client, systemClock);
		registerPayTools(mcp, token, payClient, systemClock.now);
		// no sessionIdGenerator: stateless mode
		const transport = new StreamableHTTPServerTransport({});
		res.on("close", () => {
			transport.close().catch(logError);
			mcp.close().catch(logError);
		});
		await mcp.connect(transport);
		await transport.handleRequest(req, res, body);
	} catch (error) {
		logError(error);
		if (!res.headersSent) {
			sendJson(500, { error: "internal_error" });
		}
	}
});

server.listen(config.value.port, () => {
	console.log(
		`mcp: listening on :${config.value.port}, gateway ${config.value.gatewayUrl}`,
	);
});
