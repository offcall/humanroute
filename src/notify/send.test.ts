// New-task pushes (ADR 0029) with explicit NotifyDeps and a fake PushSender.
import { describe, expect, test } from "vitest";
import {
	createTestGateway,
	expectJson,
	joinLinguist,
	objectField,
	registerAgency,
	START,
	send,
	testWallet,
	textField,
	WALLETS,
} from "../testing/index.js";
import { saveSubscription } from "./repo.js";
import { notifyNewTasks } from "./send.js";
import type {
	NotifyDeps,
	PushSender,
	PushTarget,
	SendOutcome,
	TaskNotice,
} from "./types.js";

type Delivery = { endpoint: string; payload: string; ttlSeconds: number };

const device = (name: string): PushTarget => ({
	endpoint: `https://fcm.googleapis.com/fcm/send/${name}`,
	p256dh: `p256dh-${name}`,
	auth: `auth-${name}`,
});

const notice = (taskId: string, target: string): TaskNotice => ({
	taskId,
	source: "en",
	target,
	claimDeadline: START + 60_000,
});

// Linguists: A en-es (phones a1, a2), B en-es + en-fr (b1), C en-de (c1).
const setup = async (answer: (target: PushTarget) => Promise<SendOutcome>) => {
	const { app, database } = createTestGateway();
	const agency = await registerAgency(app, WALLETS.agency);
	const people = [
		{ seed: 60, pairs: ["es"], phones: ["a1", "a2"] },
		{ seed: 61, pairs: ["es", "fr"], phones: ["b1"] },
		{ seed: 62, pairs: ["de"], phones: ["c1"] },
	];
	for (const person of people) {
		const pairs = person.pairs.map((target) => ({ source: "en", target }));
		const cookie = await joinLinguist(
			app,
			testWallet(person.seed),
			agency.inviteCode,
			pairs,
		);
		const me = await expectJson(
			await send(app, "GET", "/api/me", { cookie }),
			200,
		);
		const linguistId = textField(objectField(me, "linguist"), "id");
		for (const phone of person.phones) {
			saveSubscription(database, linguistId, device(phone), START);
		}
	}

	const deliveries: Delivery[] = [];
	const logs: string[] = [];
	const sender: PushSender = (target, payload, ttlSeconds) => {
		deliveries.push({ endpoint: target.endpoint, payload, ttlSeconds });
		return answer(target);
	};
	const deps: NotifyDeps = {
		database,
		now: () => START,
		sessionCookie: "hr_session",
		lookupSession: () => null,
		publicKey: "public-key",
		sender,
		claimWindowSeconds: 60,
		log: (msg) => logs.push(msg),
	};
	const sent = (taskId: string) =>
		deliveries
			.filter((delivery) => JSON.parse(delivery.payload).taskId === taskId)
			.map((delivery) => delivery.endpoint)
			.sort();

	return { app, database, deps, deliveries, logs, sent };
};

const ok = async (): Promise<SendOutcome> => ({ kind: "sent" });
const endpoints = (names: string[]) =>
	names.map((name) => device(name).endpoint).sort();

describe("notifyNewTasks", () => {
	test("sends one push per new task to every subscribed device of every linguist with that pair", async () => {
		const scene = await setup(ok);
		await notifyNewTasks(scene.deps)([
			notice("task-es", "es"),
			notice("task-fr", "fr"),
		]);

		expect(scene.deliveries).toHaveLength(4);
		expect(scene.sent("task-es")).toEqual(endpoints(["a1", "a2", "b1"]));
		expect(scene.sent("task-fr")).toEqual(endpoints(["b1"]));
	});

	test("the payload has task id, pair and claim deadline only, never the text or the price", async () => {
		const scene = await setup(ok);
		await notifyNewTasks(scene.deps)([notice("task-fr", "fr")]);

		const [delivery] = scene.deliveries;
		expect(JSON.parse(delivery?.payload ?? "")).toStrictEqual({
			taskId: "task-fr",
			source: "en",
			target: "fr",
			claimDeadline: new Date(START + 60_000).toISOString(),
		});
	});

	test("sends with TTL = claim window", async () => {
		const scene = await setup(ok);
		await notifyNewTasks({ ...scene.deps, claimWindowSeconds: 1800 })([
			notice("task-fr", "fr"),
		]);

		expect(scene.deliveries.map((delivery) => delivery.ttlSeconds)).toEqual([
			1800,
		]);
	});

	test("a gone subscription is deleted and other failures are logged with the task id", async () => {
		const scene = await setup(async (target) => {
			if (target.endpoint === device("a1").endpoint) {
				return { kind: "gone" };
			}
			if (target.endpoint === device("a2").endpoint) {
				return { kind: "failed", status: 429, reason: "TooManyRequests" };
			}
			return { kind: "failed", status: null, reason: "socket hang up" };
		});
		await notifyNewTasks(scene.deps)([notice("task-es", "es")]);

		const all = scene.database
			.prepare("SELECT endpoint FROM push_subscriptions")
			.pluck()
			.all();
		expect(all.sort()).toEqual(endpoints(["a2", "b1", "c1"]));
		expect(scene.logs.sort()).toEqual([
			"push failed task task-es status 429 TooManyRequests",
			"push failed task task-es status ? socket hang up",
		]);
	});

	test("one failing push does not stop the others", async () => {
		let settled = 0;
		let started = 0;
		const scene = await setup(async (target) => {
			if (target.endpoint === device("a1").endpoint) {
				throw new Error("sender broke its promise");
			}
			if (target.endpoint === device("a2").endpoint) {
				return { kind: "failed", status: 500, reason: "boom" };
			}
			// The first success (task-es on b1) is the slowest delivery of all.
			const turns = started === 0 ? 3 : 1;
			started += 1;
			for (let turn = 0; turn < turns; turn += 1) {
				await new Promise((resolve) => setImmediate(resolve));
			}
			settled += 1;
			return { kind: "sent" };
		});
		await notifyNewTasks(scene.deps)([
			notice("task-es", "es"),
			notice("task-fr", "fr"),
		]);

		expect(scene.deliveries).toHaveLength(4);
		expect(settled).toBe(2);
	});

	test("push off sends nothing and /api/push/key answers {publicKey: null}", async () => {
		const scene = await setup(ok);
		await notifyNewTasks({ ...scene.deps, sender: null })([
			notice("task-es", "es"),
		]);
		expect(scene.deliveries).toEqual([]);

		const key = await send(scene.app, "GET", "/api/push/key");
		expect(await expectJson(key, 200)).toEqual({ publicKey: null });
	});
});
