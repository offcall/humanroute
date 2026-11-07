// Child processes of an e2e run: own process group, log file, bounded readiness wait, group kill.
import { type ChildProcess, spawn } from "node:child_process";
import { openSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

export type Running = { name: string; child: ChildProcess; logFile: string };

export type ProcessSpec = {
	name: string;
	command: string;
	args: string[];
	env: Record<string, string>;
	cwd: string;
	logDir: string;
};

export const freePort = (): Promise<number> =>
	new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : 0;
			server.close(() => resolve(port));
		});
	});

export const startProcess = (spec: ProcessSpec): Running => {
	const logFile = join(spec.logDir, `${spec.name}.log`);
	const out = openSync(logFile, "a");
	const child = spawn(spec.command, spec.args, {
		cwd: spec.cwd,
		env: spec.env,
		detached: true,
		stdio: ["ignore", out, out],
	});
	return { name: spec.name, child, logFile };
};

const exited = (running: Running): boolean =>
	running.child.exitCode !== null || running.child.signalCode !== null;

// A crash: SIGKILL to the whole group at once, no shutdown handlers.
export const killProcess = (running: Running): Promise<void> =>
	stopProcess(running, 0);

// Kills the whole group: SIGTERM, then SIGKILL after graceMs (0: SIGKILL only).
export const stopProcess = async (
	running: Running,
	graceMs = 5000,
): Promise<void> => {
	const pid = running.child.pid;
	if (pid === undefined || exited(running)) {
		return;
	}
	const gone = new Promise<void>((resolve) =>
		running.child.once("exit", () => resolve()),
	);
	const signal = (name: NodeJS.Signals): void => {
		try {
			process.kill(-pid, name);
		} catch {
			// The group is already gone.
		}
	};
	signal(graceMs === 0 ? "SIGKILL" : "SIGTERM");
	const timer = setTimeout(() => signal("SIGKILL"), graceMs);
	await gone;
	clearTimeout(timer);
	signal("SIGKILL");
};

export const waitUntil = async (
	running: Running,
	ready: () => Promise<boolean>,
	timeoutMs: number,
): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (exited(running)) {
			throw new Error(`${running.name} exited early, see ${running.logFile}`);
		}
		if (await ready().catch(() => false)) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(
		`${running.name} not ready in ${timeoutMs} ms, see ${running.logFile}`,
	);
};
