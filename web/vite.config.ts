import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const gateway = "http://localhost:4021";

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	plugins: [react()],
	build: { outDir: "dist", emptyOutDir: true },
	server: {
		proxy: { "/api": gateway, "/x": gateway, "/health": gateway },
	},
});
