// Host-wide lock for one Chromium at a time (/tmp/hr-shot.lock, a mkdir lock shared with other
// threads). The owner file holds "<owner> <pid>"; a lock whose PID is alive is never removed.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOCK_DIR = "/tmp/hr-shot.lock";
const OWNER_FILE = join(LOCK_DIR, "owner");
const POLL_MS = 1000;

const alive = (pid: number): boolean => {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM: the process exists but belongs to someone else.
		return error instanceof Error && Reflect.get(error, "code") === "EPERM";
	}
};

const ownerPid = (): number | null => {
	try {
		const pid = Number(
			readFileSync(OWNER_FILE, "utf8").trim().split(" ").at(-1),
		);
		return Number.isInteger(pid) && pid > 0 ? pid : null;
	} catch {
		return null;
	}
};

const tryTake = (owner: string): boolean => {
	try {
		mkdirSync(LOCK_DIR);
	} catch {
		return false;
	}
	writeFileSync(OWNER_FILE, `${owner} ${process.pid}\n`);
	return true;
};

export type Lock = { release: () => void };

export const takeChromiumLock = async (
	owner: string,
	timeoutMs: number,
): Promise<Lock> => {
	const deadline = Date.now() + timeoutMs;
	let staleSince: number | null = null;
	while (!tryTake(owner)) {
		const pid = ownerPid();
		// No owner file yet: taken a moment ago, or by a writer that died before writing.
		if (pid === null) {
			staleSince ??= Date.now();
		} else {
			staleSince = null;
		}
		const stale =
			pid === null
				? staleSince !== null && Date.now() - staleSince > 5000
				: !alive(pid);
		if (stale) {
			rmSync(LOCK_DIR, { recursive: true, force: true });
			continue;
		}
		if (Date.now() > deadline) {
			throw new Error(
				`${LOCK_DIR} held by PID ${pid} for over ${timeoutMs} ms`,
			);
		}
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}

	const release = (): void => {
		if (ownerPid() === process.pid) {
			rmSync(LOCK_DIR, { recursive: true, force: true });
		}
		process.off("SIGINT", onSignal);
		process.off("SIGTERM", onSignal);
	};
	const onSignal = (signal: NodeJS.Signals): void => {
		release();
		process.kill(process.pid, signal);
	};
	process.once("SIGINT", onSignal);
	process.once("SIGTERM", onSignal);
	return { release };
};
