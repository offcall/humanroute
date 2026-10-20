// Config from process.env (load .env with `node --env-file=.env` or `tsx --env-file=.env`).
// Amounts are kept as integer USDC base units (6 decimals) to avoid float math.
import { readFileSync, existsSync } from 'node:fs';
import { Keypair } from '@solana/web3.js';

export const USDC_DECIMALS = 6;

export interface Config {
  rpcUrl: string;
  network: string; // CAIP-2 id used by x402
  facilitatorUrl: string;
  usdcMint: string;
  holdKeypairPath: string;
  expertWallet: string;
  priceUsdc: string; // human form, e.g. "0.50"
  priceUnits: bigint; // 500000n
  feePct: number; // e.g. 10
  releaseUnits: bigint; // price minus fee, e.g. 450000n
  refundUnits: bigint; // full price
  slaSeconds: number;
  inboxToken: string;
  port: number;
  dbPath: string;
}

export function usdcToUnits(s: string): bigint {
  const m = /^(\d+)(?:\.(\d{0,6}))?$/.exec(s.trim());
  if (!m) throw new Error(`bad USDC amount: ${s}`);
  return BigInt(m[1]) * 10n ** 6n + BigInt((m[2] ?? '').padEnd(6, '0') || '0');
}

export function unitsToUsdc(u: bigint): string {
  const whole = u / 1_000_000n;
  const frac = (u % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac.padEnd(2, '0')}` : `${whole}.00`;
}

function num(v: string | undefined, def: number, name: string): number {
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

// Falls back to the pubkey of keys/expert.json so the demo runs without extra setup.
function expertFromKeyfile(path: string): string {
  if (!existsSync(path)) return '';
  const secret = Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')) as number[]);
  return Keypair.fromSecretKey(secret).publicKey.toBase58();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const priceUsdc = env.PRICE_USDC || '0.50';
  const priceUnits = usdcToUnits(priceUsdc);
  const feePct = num(env.FEE_PCT, 10, 'FEE_PCT');
  if (feePct < 0 || feePct > 100) throw new Error('FEE_PCT must be 0..100');
  const feeUnits = (priceUnits * BigInt(Math.round(feePct * 100))) / 10_000n;
  const expertWallet = env.EXPERT_WALLET || expertFromKeyfile(env.EXPERT_KEYPAIR || 'keys/expert.json');
  if (!expertWallet) throw new Error('EXPERT_WALLET is required');
  return {
    rpcUrl: env.RPC_URL || 'https://api.devnet.solana.com',
    network: env.SOLANA_NETWORK || 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    facilitatorUrl: env.FACILITATOR_URL || 'https://x402.org/facilitator',
    usdcMint: env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    holdKeypairPath: env.HOLD_KEYPAIR_PATH || 'keys/hold.json',
    expertWallet,
    priceUsdc,
    priceUnits,
    feePct,
    releaseUnits: priceUnits - feeUnits,
    refundUnits: priceUnits,
    slaSeconds: num(env.SLA_SECONDS, 60, 'SLA_SECONDS'),
    inboxToken: env.INBOX_TOKEN || 'dev-inbox-token',
    port: num(env.PORT, 4021, 'PORT'),
    dbPath: env.DB_PATH || 'data/humanroute.db',
  };
}
