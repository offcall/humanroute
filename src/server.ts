// One process: config, SQLite, x402 routes and the payout worker.
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { HTTPFacilitatorClient, type FacilitatorClient } from '@x402/core/server';
import { loadConfig, type Config } from './config.js';
import { openDb, type Db } from './db.js';
import { createSolanaClient, loadKeypair, type SolanaClient } from './solana.js';
import { createWorker } from './worker.js';
import { xRoutes } from './routes/x.js';
import { inboxRoutes } from './routes/inbox.js';
import { jobsRoutes } from './routes/jobs.js';

export interface AppDeps {
  cfg: Config;
  db: Db;
  facilitator: FacilitatorClient;
  payTo: string;
  syncFacilitatorOnStart?: boolean;
}

export function createApp(d: AppDeps) {
  const app = new Hono();
  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/', xRoutes(d));
  app.route('/', jobsRoutes(d));
  app.route('/', inboxRoutes(d));
  return app;
}

export async function main(cfg = loadConfig()) {
  const db = openDb(cfg.dbPath);
  const sol: SolanaClient = createSolanaClient({
    rpcUrl: cfg.rpcUrl,
    mint: cfg.usdcMint,
    holdKeypairPath: cfg.holdKeypairPath,
  });
  const payTo = loadKeypair(cfg.holdKeypairPath).publicKey.toBase58();
  const worker = createWorker(db, sol, cfg);
  await worker.start(); // re-checks sent transfers before anything else
  const facilitator = new HTTPFacilitatorClient({ url: cfg.facilitatorUrl });
  const app = createApp({ cfg, db, facilitator, payTo });
  serve({ fetch: app.fetch, port: cfg.port });
  console.log(`humanroute on :${cfg.port}, payTo ${payTo}, price $${cfg.priceUsdc}, sla ${cfg.slaSeconds}s`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
