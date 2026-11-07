// Task actions on a scene as the linguist and the firm send them, and row reads.
import type { TestGateway } from "./gateway.js";
import { expectJson, send } from "./http.js";
import type { Scene } from "./scene.js";

export const claim = (scene: Scene, taskId: string, cookie = scene.linguist) =>
	send(scene.app, "POST", `/api/tasks/${taskId}/claim`, { cookie, body: {} });

export const submit = (scene: Scene, taskId: string, cookie = scene.linguist) =>
	send(scene.app, "POST", `/api/tasks/${taskId}/submit`, {
		cookie,
		body: { result: "Hola" },
	});

// Claims and submits each task as the scene's linguist.
export const submitted = async (scene: Scene, taskIds: string[]) => {
	for (const taskId of taskIds) {
		await expectJson(await claim(scene, taskId), 200);
		await expectJson(await submit(scene, taskId), 200);
	}
};

export type Auth = { cookie?: string; bearer?: string };

export const approve = (scene: Scene, taskId: string, auth: Auth) =>
	send(scene.app, "POST", `/api/tasks/${taskId}/approve`, {
		...auth,
		body: {},
	});

export const reject = (
	scene: Scene,
	taskId: string,
	auth: Auth,
	body: unknown,
) => send(scene.app, "POST", `/api/tasks/${taskId}/reject`, { ...auth, body });

export const stateOf = (scene: TestGateway, taskId: string): unknown =>
	scene.database
		.prepare("SELECT state FROM tasks WHERE id = ?")
		.pluck()
		.get(taskId);

export const rowCount = (scene: TestGateway, table: string): unknown =>
	scene.database.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get();
