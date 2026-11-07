// The whole gateway with fakes: every slice wired by src/wiring, an in-memory database, a clock
// the test moves, the fake chain and facilitator, push off. The payout worker never starts its
// timer; a test calls worker.tick() instead.
import type { Hono } from "hono";
import { type Config, parseConfig } from "../config/index.js";
import { createApp } from "../http/index.js";
import {
	createTaskWorker,
	type TaskPayoutDeps,
	type Worker,
} from "../payouts/index.js";
import { type Database, openStore } from "../store/index.js";
import { SLICES, wire } from "../wiring/index.js";
import { type FakeChain, fakeChain } from "./chain.js";
import { sequentialIds, type TestClock, testClock } from "./clock.js";
import { type FakeFacilitator, fakeFacilitator } from "./facilitator.js";
import { WALLETS } from "./wallets.js";

export type TestGateway = {
	app: Hono;
	config: Config;
	database: Database;
	chain: FakeChain;
	facilitator: FakeFacilitator;
	clock: TestClock;
	payouts: TaskPayoutDeps;
	worker: Worker;
	// Every log line as "[scope] message".
	logs: string[];
	// Preflight problems; push one to make payments answer 503 and pause payouts.
	problems: string[];
};

// Only the required values; everything else is the default (timers preset video: claim 60 s, work 180 s).
const TEST_ENV = {
	FEE_WALLET: WALLETS.fee.address,
	PUBLIC_BASE_URL: "http://humanroute.test",
	MCP_PUBLIC_URL: "http://mcp.humanroute.test/mcp",
};

export const testConfig = (): Config => {
	const parsed = parseConfig(TEST_ENV);
	if (!parsed.ok) {
		throw new Error(`test config is invalid: ${parsed.error}`);
	}

	return parsed.value;
};

export const createTestGateway = (): TestGateway => {
	const config = testConfig();
	const clock = testClock();
	const { database } = openStore(":memory:", clock.now, SLICES);
	const chain = fakeChain(WALLETS.hold.address);
	const facilitator = fakeFacilitator(
		config.network,
		WALLETS.facilitator.address,
		WALLETS.firm.address,
	);
	const logs: string[] = [];
	const problems: string[] = [];

	const wired = wire({
		config,
		database,
		chain,
		facilitator,
		preflightProblems: () => problems,
		now: clock.now,
		newId: sequentialIds(),
		log: (scope) => (msg) => {
			logs.push(`[${scope}] ${msg}`);
		},
	});

	return {
		app: createApp(wired.app),
		config,
		database,
		chain,
		facilitator,
		clock,
		payouts: wired.payouts,
		worker: createTaskWorker(wired.payouts),
		logs,
		problems,
	};
};
