// Fake Phantom provider for one browser context (one role). The page side only moves bytes; the
// key stays in Node: connect, signMessage, signTransaction and signAndSendTransaction cross the
// bridge (page.exposeBinding) and are signed here, sends go to the environment's RPC.
import type { Keypair } from "@solana/web3.js";
import { VersionedTransaction } from "@solana/web3.js";
import type { BrowserContext } from "playwright";
import { connection } from "../support/env.js";
import { signText } from "../support/people.js";

export enum PhantomCall {
	Connect = "connect",
	Message = "message",
	Transaction = "transaction",
	Send = "send",
}

export type Phantom = {
	key: Keypair;
	// The wallet connect() reports; defaults to key (a different one simulates a wrong account).
	connectAs: string | null;
	calls: PhantomCall[];
};

type Reply = { value: string } | { error: string; code: number };

const signBytes = (key: Keypair, base64: string): string => {
	const tx = VersionedTransaction.deserialize(Buffer.from(base64, "base64"));
	tx.sign([key]);
	return Buffer.from(tx.serialize()).toString("base64");
};

const answer = async (
	phantom: Phantom,
	kind: string,
	data: string,
): Promise<Reply> => {
	const call = Object.values(PhantomCall).find((item) => item === kind);
	if (call === undefined) {
		return { error: `unknown call ${kind}`, code: -32603 };
	}
	phantom.calls.push(call);
	switch (call) {
		case PhantomCall.Connect:
			return { value: phantom.connectAs ?? phantom.key.publicKey.toBase58() };
		case PhantomCall.Message: {
			const text = Buffer.from(data, "base64").toString("utf8");
			return { value: signText(phantom.key, text) };
		}
		case PhantomCall.Transaction:
			return { value: signBytes(phantom.key, data) };
		case PhantomCall.Send: {
			const raw = Buffer.from(signBytes(phantom.key, data), "base64");
			const signature = await connection().sendRawTransaction(raw);
			const latest = await connection().getLatestBlockhash("confirmed");
			await connection().confirmTransaction(
				{ signature, ...latest },
				"confirmed",
			);
			return { value: signature };
		}
	}
};

// Runs in the page before any app script.
const pageProvider = () => {
	type Bridge = (
		kind: string,
		data: string,
	) => Promise<{ value?: string; error?: string; code?: number }>;
	const bridge: Bridge = Reflect.get(window, "__hrPhantom");
	const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
	const unb64 = (text: string) =>
		Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
	const call = async (kind: string, bytes: Uint8Array): Promise<string> => {
		const reply = await bridge(kind, b64(bytes));
		if (reply.error !== undefined) {
			// Phantom rejects with plain objects such as { code: 4001, message }.
			throw Object.assign(new Error(reply.error), { code: reply.code });
		}
		return reply.value ?? "";
	};
	type Serializable = { serialize: () => Uint8Array };
	type Key = { toString: () => string; toBase58: () => string };
	const state: { publicKey: Key | null } = { publicKey: null };
	const provider = {
		isPhantom: true,
		get isConnected() {
			return state.publicKey !== null;
		},
		get publicKey() {
			return state.publicKey;
		},
		connect: async () => {
			const address = await call("connect", new Uint8Array());
			const publicKey = { toString: () => address, toBase58: () => address };
			state.publicKey = publicKey;
			return { publicKey };
		},
		disconnect: async () => undefined,
		on: () => undefined,
		off: () => undefined,
		removeListener: () => undefined,
		signMessage: async (message: Uint8Array) => ({
			signature: unb64(await call("message", message)),
			publicKey: provider.publicKey,
		}),
		signTransaction: async (tx: Serializable) => {
			const bytes = unb64(await call("transaction", tx.serialize()));
			return { serialize: () => bytes };
		},
		signAndSendTransaction: async (tx: Serializable) => ({
			signature: await call("send", tx.serialize()),
			publicKey: provider.publicKey,
		}),
	};
	Reflect.set(window, "phantom", { solana: provider });
	Reflect.set(window, "solana", provider);
};

export const installPhantom = async (
	context: BrowserContext,
	key: Keypair,
): Promise<Phantom> => {
	const phantom: Phantom = {
		key,
		connectAs: null,
		calls: [],
	};
	await context.exposeBinding(
		"__hrPhantom",
		(_source, kind: string, data: string) => answer(phantom, kind, data),
	);
	await context.addInitScript(pageProvider);
	return phantom;
};
