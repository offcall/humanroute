// A controllable JSON-RPC forwarder between a gateway and the validator (gateway restart test). Every call is
// forwarded, except sendTransaction while the gate holds sends: then it is swallowed before the
// chain (DropBeforeChain) or forwarded and landed but never answered (LandNoReply).
import { createServer, type IncomingMessage, type Server } from "node:http";
import { connection } from "./env.js";
import { isRecord } from "./http.js";

export enum GateMode {
	Pass = "pass",
	DropBeforeChain = "drop_before_chain",
	LandNoReply = "land_no_reply",
}

export type RpcGate = {
	url: string;
	mode: GateMode;
	// Resolves on the first held sendTransaction, with its signature once landed (LandNoReply).
	held: Promise<string | null>;
	stop: () => Promise<void>;
};

const readBody = async (req: IncomingMessage): Promise<string> => {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
	}
	return Buffer.concat(chunks).toString("utf8");
};

const isSend = (body: string): boolean => {
	const parsed: unknown = JSON.parse(body);
	return isRecord(parsed) && parsed.method === "sendTransaction";
};

const signatureOf = (answer: string): string | null => {
	const parsed: unknown = JSON.parse(answer);
	return isRecord(parsed) && typeof parsed.result === "string"
		? parsed.result
		: null;
};

export const startRpcGate = async (target: string): Promise<RpcGate> => {
	let release: (signature: string | null) => void = () => undefined;
	const gate: RpcGate = {
		url: "",
		mode: GateMode.Pass,
		held: new Promise((resolve) => {
			release = resolve;
		}),
		stop: async () => undefined,
	};
	const forward = async (body: string): Promise<string> =>
		(
			await fetch(target, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
			})
		).text();

	const server: Server = createServer(async (req, res) => {
		const body = await readBody(req);
		const mode = gate.mode;
		if (mode !== GateMode.Pass && isSend(body)) {
			if (mode === GateMode.DropBeforeChain) {
				release(null);
				return;
			}
			const signature = signatureOf(await forward(body));
			if (signature !== null) {
				const latest = await connection().getLatestBlockhash("confirmed");
				await connection().confirmTransaction(
					{ signature, ...latest },
					"confirmed",
				);
			}
			release(signature);
			return;
		}
		const answer = await forward(body).catch(() => null);
		if (answer === null) {
			res.writeHead(502).end();
			return;
		}
		res.writeHead(200, { "content-type": "application/json" }).end(answer);
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const port = typeof address === "object" && address ? address.port : 0;
	gate.url = `http://127.0.0.1:${port}`;
	gate.stop = () =>
		new Promise((resolve) => {
			server.closeAllConnections();
			server.close(() => resolve());
		});
	return gate;
};
