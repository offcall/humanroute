// Serves the built web app (web/dist). Unknown paths get index.html so client routes like /join/:code work.
// /api, /x and /health never fall back to the web app (ADR 0026).
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { Hono } from "hono";

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".webmanifest": "application/manifest+json",
	".png": "image/png",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

const isGatewayPath = (path: string): boolean =>
	path === "/health" || path.startsWith("/api/") || path.startsWith("/x/");

const readIfFile = async (file: string): Promise<Buffer | null> => {
	try {
		const info = await stat(file);
		return info.isFile() ? await readFile(file) : null;
	} catch {
		return null;
	}
};

export const webRoutes = (distDir: string): Hono => {
	const app = new Hono();
	const root = resolve(distDir);

	app.get("*", async (ctx) => {
		const path = ctx.req.path;
		if (isGatewayPath(path)) {
			return ctx.json({ error: "not_found" }, 404);
		}
		const requested = resolve(root, `.${path}`);
		const asset = requested.startsWith(`${root}${sep}`)
			? await readIfFile(requested)
			: null;
		const index = await readIfFile(join(root, "index.html"));
		if (index === null) {
			return ctx.text("web app not built: run npm run build", 503);
		}
		const type = asset ? MIME[extname(requested)] : MIME[".html"];
		return ctx.body(new Uint8Array(asset ?? index), 200, {
			"content-type": type ?? "application/octet-stream",
		});
	});

	return app;
};
