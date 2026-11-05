import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const gateway = "http://localhost:4021";

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	plugins: [react()],
	build: {
		outDir: "dist",
		emptyOutDir: true,
		rollupOptions: {
			// The service worker is a second entry, emitted as /sw.js (scope /, ADR 0029).
			input: { index: "index.html", sw: "sw/sw.ts" },
			output: {
				entryFileNames: (chunk) =>
					chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js",
			},
		},
	},
	server: {
		proxy: { "/api": gateway, "/x": gateway, "/health": gateway },
	},
});
