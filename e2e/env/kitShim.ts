// Compatibility shim for the local facilitator only (ADR 0038). @x402/svm 2.28.0 imports the
// payer's Ed25519 public key as non-extractable, and @solana/kit 8.5 verifySignature refuses such
// keys, so every signature check fails. Importing Ed25519 raw public keys as extractable restores
// the SDK's check; the signature is still verified by WebCrypto.
const isEd25519 = (algorithm: unknown): boolean =>
	algorithm === "Ed25519" ||
	(typeof algorithm === "object" &&
		algorithm !== null &&
		Reflect.get(algorithm, "name") === "Ed25519");

export const makeEd25519KeysExtractable = (): void => {
	const subtle = globalThis.crypto.subtle;
	const original = subtle.importKey;
	const patched = (...args: unknown[]): unknown => {
		const [format, , algorithm] = args;
		if (format === "raw" && isEd25519(algorithm)) {
			args[3] = true;
		}
		return Reflect.apply(original, subtle, args);
	};
	Object.defineProperty(subtle, "importKey", { value: patched });
};
