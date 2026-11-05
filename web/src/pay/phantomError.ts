// Phantom rejects with objects like { code: -32603, message: "Unexpected error" }; keep both.
export const phantomError = (error: unknown): Error => {
	const holder = typeof error === "object" && error !== null ? error : {};
	const message: unknown = Reflect.get(holder, "message");
	const code: unknown = Reflect.get(holder, "code");
	const text = typeof message === "string" ? message : String(error);
	const suffix =
		typeof code === "number" || typeof code === "string"
			? ` (code ${code})`
			: "";

	return new Error(`Phantom rejected signing: ${text}${suffix}`);
};
