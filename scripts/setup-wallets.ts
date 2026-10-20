// Idempotent devnet wallet setup for the HumanRoute spike.
// - keys/{hold,agent,expert}.json: Solana CLI-style 64-byte secret key arrays (created once)
// - airdrops devnet SOL to hold and agent when below MIN_SOL
// - creates the USDC ATAs for all three (hold pays rent)
// - --fallback-mint: creates an own 6-decimal SPL mint (authority = hold), mints 100 to agent,
//   and records it in keys/test-mint.json (deviation from real devnet USDC)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import { base58 } from '@scure/base';

const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const KEYS_DIR = 'keys';
const TEST_MINT_FILE = `${KEYS_DIR}/test-mint.json`;
const MIN_SOL = 0.5;
const AIRDROP_SOL = 1;
const FALLBACK = process.argv.includes('--fallback-mint');

const conn = new Connection(RPC_URL, 'confirmed');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadOrCreate(name: string): Keypair {
  const path = `${KEYS_DIR}/${name}.json`;
  if (existsSync(path)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))));
  }
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  console.log(`created ${path}`);
  return kp;
}

async function retry<T>(label: string, fn: () => Promise<T>, tries = 5): Promise<T> {
  let delay = 2000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      console.warn(`${label} failed (attempt ${i}/${tries}): ${(e as Error).message}`);
      if (i >= tries) throw e;
      await sleep(delay);
      delay *= 2;
    }
  }
}

async function ensureSol(name: string, pk: PublicKey) {
  const bal = await conn.getBalance(pk);
  if (bal >= MIN_SOL * LAMPORTS_PER_SOL) return;
  try {
    await retry(`airdrop ${name}`, async () => {
      const sig = await conn.requestAirdrop(pk, AIRDROP_SOL * LAMPORTS_PER_SOL);
      const bh = await conn.getLatestBlockhash();
      await conn.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
      console.log(`airdropped ${AIRDROP_SOL} SOL to ${name}: ${sig}`);
    });
  } catch {
    console.warn(`airdrop to ${name} gave up; balance stays ${bal / LAMPORTS_PER_SOL} SOL`);
  }
}

async function tokenBalance(mint: PublicKey, owner: PublicKey): Promise<string> {
  const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
  try {
    const acc = await getAccount(conn, getAssociatedTokenAddressSync(mint, owner));
    return (Number(acc.amount) / 1e6).toFixed(6);
  } catch {
    return 'no ATA';
  }
}

mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
const wallets = { hold: loadOrCreate('hold'), agent: loadOrCreate('agent'), expert: loadOrCreate('expert') };

await ensureSol('hold', wallets.hold.publicKey);
await ensureSol('agent', wallets.agent.publicKey);

const holdSol = await conn.getBalance(wallets.hold.publicKey);
if (holdSol === 0) {
  console.error('hold wallet has no SOL; cannot create ATAs');
  process.exit(1);
}

const mints = [new PublicKey(DEVNET_USDC)];
let testMint: PublicKey | undefined;
if (existsSync(TEST_MINT_FILE)) {
  testMint = new PublicKey(JSON.parse(readFileSync(TEST_MINT_FILE, 'utf8')).mint);
} else if (FALLBACK) {
  testMint = await retry('createMint', () => createMint(conn, wallets.hold, wallets.hold.publicKey, null, 6));
  writeFileSync(TEST_MINT_FILE, JSON.stringify({ mint: testMint.toBase58(), decimals: 6, authority: 'hold' }));
  console.log(`created test mint ${testMint.toBase58()}`);
}
if (testMint) mints.push(testMint);

for (const mint of mints) {
  for (const [name, kp] of Object.entries(wallets)) {
    const ata = await retry(`ATA ${name}`, () =>
      getOrCreateAssociatedTokenAccount(conn, wallets.hold, mint, kp.publicKey),
    );
    if (mint === testMint && name === 'agent' && FALLBACK && ata.amount === 0n) {
      const sig = await retry('mintTo', () => mintTo(conn, wallets.hold, mint, ata.address, wallets.hold, 100_000_000n));
      console.log(`minted 100 test tokens to agent: ${sig}`);
    }
  }
}

console.log(`\nRPC ${RPC_URL}`);
for (const [name, kp] of Object.entries(wallets)) {
  const sol = (await conn.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL;
  const usdc = await tokenBalance(mints[0], kp.publicKey);
  const extra = testMint ? `  testMint=${await tokenBalance(testMint, kp.publicKey)}` : '';
  console.log(`${name.padEnd(6)} ${kp.publicKey.toBase58()}  SOL=${sol}  USDC=${usdc}${extra}`);
  if (process.argv.includes('--print-base58')) console.log(`  base58 secret: ${base58.encode(kp.secretKey)}`);
}
if (testMint) console.log(`test mint (deviation): ${testMint.toBase58()}`);
