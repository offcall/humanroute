// Local x402 facilitator server: the SDK's exact SVM facilitator (@x402/svm) on loopback HTTP,
// talking to the local validator. Same wire protocol as x402.org: GET /supported, POST /verify,
// POST /settle. The facilitator key pays the fees and co-signs. Runs in facilitatorMain.ts.
import { createServer, type IncomingMessage } from "node:http";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { x402Facilitator } from "@x402/core/facilitator";
import {
	isPaymentPayloadV2,
	isPaymentRequirementsV2,
} from "@x402/core/schemas";
import type {
	Network,
	PaymentPayload,
	PaymentRequirements,
} from "@x402/core/types";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";

const readJson = async (req: IncomingMessage): Promise<unknown> => {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const field = (body: unknown, key: string): unknown =>
	typeof body === "object" && body !== null ? Reflect.get(body, key) : null;

// The SDK schemas check the shape; these guards name the SDK types the facilitator takes.
const isPayload = (value: unknown): value is PaymentPayload =>
	isPaymentPayloadV2(value);
const isRequirements = (value: unknown): value is PaymentRequirements =>
	isPaymentRequirementsV2(value);

const stringify = (value: unknown): string =>
	JSON.stringify(value, (_key, item) =>
		typeof item === "bigint" ? item.toString() : item,
	);

export const serveFacilitator = async (
	secret: Uint8Array,
	rpcUrl: string,
	network: Network,
	port: number,
): Promise<void> => {
	const signer = await createKeyPairSignerFromBytes(secret);
	const facilitator = registerExactSvmScheme(new x402Facilitator(), {
		signer: toFacilitatorSvmSigner(signer, { defaultRpcUrl: rpcUrl }),
		networks: network,
	});

	const server = createServer(async (req, res) => {
		const send = (status: number, body: unknown): void => {
			res.writeHead(status, { "content-type": "application/json" });
			res.end(stringify(body));
		};
		try {
			if (req.method === "GET" && req.url === "/supported") {
				send(200, facilitator.getSupported());
				return;
			}
			if (req.method !== "POST") {
				send(404, { error: "not_found" });
				return;
			}
			const body = await readJson(req);
			const payload = field(body, "paymentPayload");
			const requirements = field(body, "paymentRequirements");
			if (!isPayload(payload) || !isRequirements(requirements)) {
				send(400, { error: "invalid_body" });
				return;
			}
			if (req.url === "/verify") {
				const result = await facilitator.verify(payload, requirements);
				send(result.isValid ? 200 : 400, result);
				return;
			}
			if (req.url === "/settle") {
				const result = await facilitator.settle(payload, requirements);
				send(result.success ? 200 : 400, result);
				return;
			}
			send(404, { error: "not_found" });
		} catch (error) {
			send(500, { error: error instanceof Error ? error.message : "failed" });
		}
	});
	await new Promise<void>((resolve) =>
		server.listen(port, "127.0.0.1", resolve),
	);
};
