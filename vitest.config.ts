// Test projects (ADR 0037). `npm test` runs unit + web: no validator, no port, no network.
// e2e runs the real gateway and MCP against a local validator (ADR 0038); e2e-devnet runs the
// same suite against devnet only with the owner's permission; smoke reads an external target.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const E2E_TESTS = ["e2e/**/*.test.ts"];
const SMOKE_TESTS = ["e2e/smoke/**/*.test.ts"];

export default defineConfig({
	test: {
		pool: "forks",
		maxWorkers: 2,
		projects: [
			{
				test: {
					name: "unit",
					environment: "node",
					include: [
						"src/**/*.test.ts",
						"mcp/**/*.test.ts",
						"contracts/**/*.test.ts",
					],
				},
			},
			{
				plugins: [react()],
				test: {
					name: "web",
					environment: "jsdom",
					include: ["web/src/**/*.test.tsx"],
				},
			},
			{
				test: {
					name: "e2e",
					environment: "node",
					include: E2E_TESTS,
					exclude: SMOKE_TESTS,
					globalSetup: ["e2e/env/localnet.setup.ts"],
					testTimeout: 120_000,
					hookTimeout: 180_000,
					fileParallelism: false,
				},
			},
			{
				test: {
					name: "e2e-devnet",
					environment: "node",
					include: E2E_TESTS,
					exclude: SMOKE_TESTS,
					globalSetup: ["e2e/env/devnet.setup.ts"],
					testTimeout: 600_000,
					hookTimeout: 600_000,
					fileParallelism: false,
				},
			},
			{
				test: {
					name: "smoke",
					environment: "node",
					include: SMOKE_TESTS,
					testTimeout: 60_000,
				},
			},
		],
	},
});
