// Prints the public key of the fee wallet keypair (created on first use); never the secret.
import { loadOrCreateKeypair } from "./wallets/keypairs.js";

const path = process.env.FEE_KEYPAIR_PATH || "keys/fee.json";

console.log(loadOrCreateKeypair(path).publicKey.toBase58());
