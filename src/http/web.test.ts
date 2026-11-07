// Static web app (web/dist) with SPA fallback (ADR 0026), against a temp dist made by the test.
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { webRoutes } from "./web.js";

const SENTINEL = "SENTINEL-outside-dist-7f3a";
const INDEX = "<!doctype html><title>HumanRoute</title>";

const temp = mkdtempSync(join(tmpdir(), "hr-web-"));
const dist = join(temp, "dist");
const empty = join(temp, "empty");
const FILES: Record<string, string> = {
	"index.html": INDEX,
	"assets/app-1a2b.js": "console.log(1)",
	"assets/app-1a2b.css": "body{}",
	"manifest.webmanifest": "{}",
	"data.json": "{}",
	"icon.png": "png",
	"logo.svg": "<svg/>",
	"favicon.ico": "ico",
	"agent/sign.mjs": "export {}",
	"blob.xyz": "bytes",
};
for (const [name, content] of Object.entries(FILES)) {
	mkdirSync(join(dist, name, ".."), { recursive: true });
	writeFileSync(join(dist, name), content);
}
mkdirSync(join(empty, "assets"), { recursive: true });
writeFileSync(join(empty, "assets", "app.js"), "console.log(1)");
writeFileSync(join(temp, "secret.txt"), SENTINEL);
symlinkSync(join(temp, "secret.txt"), join(dist, "leak.txt"));
symlinkSync(temp, join(dist, "outside"));
symlinkSync(join(temp, "secret.txt"), join(dist, "assets", "leak.js"));

afterAll(() => {
	rmSync(temp, { recursive: true, force: true });
});

const web = webRoutes(dist);
const get = (path: string) => web.request(path);

describe("web app", () => {
	it("HT-01 serves index.html for client routes", async () => {
		for (const path of ["/", "/join/abc123", "/firm/jobs", "/approve/0123"]) {
			const res = await get(path);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
			expect(await res.text()).toBe(INDEX);
		}
	});

	it.each([
		["/assets/app-1a2b.js", "text/javascript; charset=utf-8"],
		["/assets/app-1a2b.css", "text/css; charset=utf-8"],
		["/manifest.webmanifest", "application/manifest+json"],
		["/data.json", "application/json; charset=utf-8"],
		["/icon.png", "image/png"],
		["/logo.svg", "image/svg+xml"],
		["/favicon.ico", "image/x-icon"],
		["/agent/sign.mjs", "text/javascript; charset=utf-8"],
		["/blob.xyz", "application/octet-stream"],
	])("HT-02 serves %s as %s", async (path, type) => {
		const res = await get(path);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe(type);
		expect(await res.text()).toBe(FILES[path.slice(1)]);
	});

	it("HT-03 never serves files outside the dist folder", async () => {
		const paths = [
			"/../secret.txt",
			"/%2e%2e/secret.txt",
			"/%2E%2E%2Fsecret.txt",
			"/..%2fsecret.txt",
			"/assets/..%2f..%2fsecret.txt",
			"/assets/%2e%2e/%2e%2e/secret.txt",
			"/..\\secret.txt",
		];
		for (const path of paths) {
			const res = await get(path);
			expect(await res.text()).not.toContain(SENTINEL);
		}
	});

	it("NEW-16 a dist symlink cannot expose a file outside the distribution root", async () => {
		for (const path of [
			"/leak.txt",
			"/outside/secret.txt",
			"/assets/leak.js",
		]) {
			const res = await get(path);
			expect(await res.text()).not.toContain(SENTINEL);
		}
		expect((await get("/assets/leak.js")).status).toBe(404);
	});

	it("HT-04 GET /api/<name>, /x/<name> and /health paths never fall back to the SPA", async () => {
		for (const path of ["/api/x", "/x/y", "/health"]) {
			const res = await get(path);
			expect(res.status).toBe(404);
			expect(await res.json()).toEqual({ error: "not_found" });
		}
		// Characterized as today: bare /api and /x are client paths; other methods are not served.
		expect(await (await get("/api")).text()).toBe(INDEX);
		expect(await (await get("/x")).text()).toBe(INDEX);
		expect((await web.request("/", { method: "POST" })).status).toBe(404);
	});

	it("HT-05 answers 503 web app not built when index.html is missing", async () => {
		const unbuilt = webRoutes(empty);
		for (const path of ["/", "/assets/app.js"]) {
			const res = await unbuilt.request(path);
			expect(res.status).toBe(503);
			expect(await res.text()).toBe("web app not built: run npm run build");
		}
	});

	it("HT-06 a missing file under /assets/ answers 404, not index.html", async () => {
		const res = await get("/assets/app-old9.js");
		expect(res.status).toBe(404);
		expect(res.headers.get("content-type")).not.toContain("text/html");
		expect(await res.text()).not.toBe(INDEX);
	});
});
