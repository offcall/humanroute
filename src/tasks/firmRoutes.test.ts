// Approve and reject by the owner firm (ADR 0030): failure table rows 21 and 22.
import { describe, expect, test } from "vitest";
import {
	type Auth,
	approve,
	claim,
	expectJson,
	paidOrder,
	registerFirm,
	reject,
	rowCount,
	type Scene,
	stateOf,
	submit,
	submitted as submitAll,
	testWallet,
} from "../testing/index.js";

// One paid order (es, fr), both tasks claimed and submitted by the linguist.
const submitted = async (): Promise<Scene> => {
	const scene = await paidOrder();
	await submitAll(scene, [scene.es, scene.fr]);
	return scene;
};

const transferCount = (scene: Scene): unknown => rowCount(scene, "transfers");

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
