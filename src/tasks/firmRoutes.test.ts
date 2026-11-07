// Approve and reject by the owner firm (ADR 0030): failure table rows 21 and 22.
import { describe, expect, test } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	joinLinguist,
	listField,
	payDraft,
	paymentFor,
	registerAgency,
	registerFirm,
	send,
	type TestFirm,
	type TestGateway,
	testWallet,
	textField,
	WALLETS,
} from "../testing/index.js";

type Scene = TestGateway & {
	firm: TestFirm;
	linguist: string;
	es: string;
	fr: string;
};

// One paid order (es, fr) and a linguist of both pairs; nothing claimed yet.
const paidOrder = async (): Promise<Scene> => {
	const gateway = createTestGateway();
	const { app } = gateway;
	const firm = await registerFirm(app, WALLETS.firm);
	const agency = await registerAgency(app, WALLETS.agency);
	const linguist = await joinLinguist(
		app,
		WALLETS.linguist,
		agency.inviteCode,
		[
			{ source: "en", target: "es" },
			{ source: "en", target: "fr" },
		],
	);
	const draftId = textField(await createDraft(app, firm.mcpToken), "draftId");
	const header = await paymentFor(app, draftId, WALLETS.firm, "order-1");
	const paid = await expectJson(await payDraft(app, draftId, header), 201);
	const order = await expectJson(
		await send(app, "GET", `/api/orders/${textField(paid, "orderId")}`, {
			bearer: firm.mcpToken,
		}),
		200,
	);
	const idOf = (lang: string) =>
		textField(
			listField(order, "tasks").find((task) => task.targetLang === lang) ?? {},
			"taskId",
		);

	return { ...gateway, firm, linguist, es: idOf("es"), fr: idOf("fr") };
};

const claim = (scene: Scene, taskId: string) =>
	send(scene.app, "POST", `/api/tasks/${taskId}/claim`, {
		cookie: scene.linguist,
		body: {},
	});

const submit = (scene: Scene, taskId: string) =>
	send(scene.app, "POST", `/api/tasks/${taskId}/submit`, {
		cookie: scene.linguist,
		body: { result: "Hola" },
	});

const submitted = async (): Promise<Scene> => {
	const scene = await paidOrder();
	for (const taskId of [scene.es, scene.fr]) {
		await expectJson(await claim(scene, taskId), 200);
		await expectJson(await submit(scene, taskId), 200);
	}
	return scene;
};

const approve = (scene: Scene, taskId: string, auth: Auth) =>
	send(scene.app, "POST", `/api/tasks/${taskId}/approve`, {
		...auth,
		body: {},
	});

const reject = (scene: Scene, taskId: string, auth: Auth, body: unknown) =>
	send(scene.app, "POST", `/api/tasks/${taskId}/reject`, { ...auth, body });

type Auth = { cookie?: string; bearer?: string };

const stateOf = (scene: Scene, taskId: string): unknown =>
	scene.database
		.prepare("SELECT state FROM tasks WHERE id = ?")
		.pluck()
		.get(taskId);

const transferCount = (scene: Scene): unknown =>
	scene.database.prepare("SELECT COUNT(*) FROM transfers").pluck().get();

describe("approve and reject", () => {
	test("the owner firm approves a submitted task by cookie and by MCP token", async () => {
		const scene = await submitted();
		const byCookie = await approve(scene, scene.es, {
			cookie: scene.firm.cookie,
		});
		expect(await expectJson(byCookie, 200)).toMatchObject({
			taskId: scene.es,
			state: "approved",
			publicState: "paying_out",
		});
		const byToken = await approve(scene, scene.fr, {
			bearer: scene.firm.mcpToken,
		});
		expect(await expectJson(byToken, 200)).toMatchObject({ state: "approved" });
	});

	test("another firm's cookie or token gets 403 and no credentials 401", async () => {
		const scene = await submitted();
		const other = await registerFirm(scene.app, testWallet(41));
		const owner = scene.firm.cookie;
		const reason = { reason: "wrong terms" };
		const cases: [Auth, number][] = [
			[{ cookie: other.cookie }, 403],
			[{ bearer: other.mcpToken }, 403],
			[{}, 401],
			[{ bearer: "unknown-token", cookie: owner }, 401],
			[{ bearer: other.mcpToken, cookie: owner }, 403],
		];
		for (const [auth, status] of cases) {
			expect((await approve(scene, scene.es, auth)).status).toBe(status);
			expect((await reject(scene, scene.es, auth, reason)).status).toBe(status);
		}
		expect(stateOf(scene, scene.es)).toBe("submitted");
	});

	const STATES: [string, (scene: Scene) => Promise<void>][] = [
		["open", async () => {}],
		["claimed", async (scene) => void (await claim(scene, scene.es))],
		[
			"expired_unclaimed",
			async (scene) => {
				scene.clock.advance(60_000);
				await scene.worker.tick();
			},
		],
		[
			"expired_late",
			async (scene) => {
				await claim(scene, scene.es);
				scene.clock.advance(180_000);
				await scene.worker.tick();
			},
		],
		[
			"approved",
			async (scene) => {
				await claim(scene, scene.es);
				await submit(scene, scene.es);
				await approve(scene, scene.es, { bearer: scene.firm.mcpToken });
			},
		],
		[
			"rejected",
			async (scene) => {
				await claim(scene, scene.es);
				await submit(scene, scene.es);
				await reject(
					scene,
					scene.es,
					{ bearer: scene.firm.mcpToken },
					{
						reason: "wrong terms",
					},
				);
			},
		],
	];

	test.each(STATES)(
		"approve or reject of a task that is not submitted answers 409 bad_state (%s)",
		async (state, reach) => {
			const scene = await paidOrder();
			await reach(scene);
			expect(stateOf(scene, scene.es)).toBe(state);
			const transfers = transferCount(scene);
			const auth = { bearer: scene.firm.mcpToken };
			const conflict = { error: "bad_state" };

			expect(
				await expectJson(await approve(scene, scene.es, auth), 409),
			).toEqual(conflict);
			const rejected = await reject(scene, scene.es, auth, { reason: "late" });
			expect(await expectJson(rejected, 409)).toEqual(conflict);
			expect(stateOf(scene, scene.es)).toBe(state);
			expect(transferCount(scene)).toBe(transfers);
		},
	);

	test.each([
		["missing", {}, 422],
		["blank", { reason: "   " }, 422],
		["1001 characters", { reason: "x".repeat(1001) }, 422],
		["1000 characters", { reason: "x".repeat(1000) }, 200],
		["1000 characters padded", { reason: ` ${"x".repeat(1000)}  ` }, 200],
	])("reject with a %s reason answers %i", async (_name, body, status) => {
		const scene = await submitted();
		const res = await reject(
			scene,
			scene.es,
			{ cookie: scene.firm.cookie },
			body,
		);
		expect(res.status).toBe(status);
		if (status === 422) {
			expect(await res.json()).toEqual({ error: "reason_required" });
			expect(stateOf(scene, scene.es)).toBe("submitted");
		}
	});

	test("reject stores the trimmed reason on the task", async () => {
		const scene = await submitted();
		const body = { reason: "  Wrong dosage term.\n" };
		const res = await reject(
			scene,
			scene.es,
			{ cookie: scene.firm.cookie },
			body,
		);
		expect(await expectJson(res, 200)).toMatchObject({
			state: "rejected",
			reason: "Wrong dosage term.",
		});
	});

	test("reject with malformed JSON answers 400 invalid_json", async () => {
		const scene = await submitted();
		const res = await scene.app.request(`/api/tasks/${scene.es}/reject`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie: scene.firm.cookie,
			},
			body: '{"reason":',
		});
		expect(await expectJson(res, 400)).toEqual({ error: "invalid_json" });
		expect(stateOf(scene, scene.es)).toBe("submitted");
	});
});
