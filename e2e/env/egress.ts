// Loopback-only network for e2e processes (ADR 0038): any TCP connect or DNS lookup to a
// non-loopback host is refused and appended to E2E_EGRESS_LOG, which the environment test expects empty.
// Child processes load it through egressPreload.ts; the e2e workers and the setup call it directly.
import dns from "node:dns";
import { appendFileSync } from "node:fs";
import net from "node:net";

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"]);

export const isLoopback = (host: string): boolean =>
	LOOPBACK.has(host) || host.startsWith("127.");

const record = (host: string): Error => {
	const line = `${process.pid} ${process.argv[1] ?? "?"} ${host}\n`;
	const file = process.env.E2E_EGRESS_LOG;
	if (file) {
		appendFileSync(file, line);
	}
	return new Error(`e2e egress blocked: ${host}`);
};

const hostOf = (args: unknown[]): string | null => {
	const [first, second] = args;
	// net.connect passes its normalized [options, callback] array.
	if (Array.isArray(first)) {
		return hostOf(first);
	}
	if (typeof first === "object" && first !== null) {
		if (Reflect.get(first, "path") !== undefined) {
			return null;
		}
		const host = Reflect.get(first, "host");
		return typeof host === "string" ? host : "localhost";
	}
	if (typeof first === "number" || typeof first === "string") {
		if (typeof first === "string" && Number.isNaN(Number(first))) {
			return null;
		}
		return typeof second === "string" ? second : "localhost";
	}
	return null;
};

let installed = false;

export const installEgressGuard = (): void => {
	if (installed) {
		return;
	}
	installed = true;
	const original = net.Socket.prototype.connect;
	const guarded = function (this: net.Socket, ...args: unknown[]): net.Socket {
		const host = hostOf(args);
		if (host !== null && !isLoopback(host)) {
			const error = record(host);
			process.nextTick(() => this.destroy(error));
			return this;
		}
		return Reflect.apply(original, this, args);
	};
	// defineProperty keeps Node's overloaded connect signature on the prototype.
	Object.defineProperty(net.Socket.prototype, "connect", {
		value: guarded,
		writable: true,
	});

	const originalLookup = dns.lookup;
	const guardedLookup = (hostname: string, ...rest: unknown[]): void => {
		if (!isLoopback(hostname)) {
			const error = record(hostname);
			const callback = rest.at(-1);
			if (typeof callback === "function") {
				process.nextTick(() => callback(error));
			}
			return;
		}
		Reflect.apply(originalLookup, dns, [hostname, ...rest]);
	};
	Object.defineProperty(dns, "lookup", {
		value: guardedLookup,
		writable: true,
	});
};
