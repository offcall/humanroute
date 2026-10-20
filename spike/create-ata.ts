// Throwaway: create the test-mint ATA for a wallet, rent paid by hold. Usage: tsx spike/create-ata.ts <wallet>
import { readFileSync } from 'node:fs';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const hold = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync('keys/hold.json', 'utf8'))));
const mint = new PublicKey(JSON.parse(readFileSync('keys/test-mint.json', 'utf8')).mint as string);
const owner = new PublicKey(process.argv[2] as string);
const ata = await getOrCreateAssociatedTokenAccount(conn, hold, mint, owner);
console.log('ata', ata.address.toBase58(), 'amount', ata.amount.toString());
