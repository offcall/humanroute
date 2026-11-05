import { useState } from "react";
import { isRecord, navigate, request, useSession } from "../shared";

// One busy flag per button: which button is busy and what it waits for.
export enum Busy {
	Idle = "idle",
	SignFirm = "sign-firm",
	RegisterFirm = "register-firm",
	SignAgency = "sign-agency",
}

export enum Failure {
	NoWallet = "no-wallet",
	Sign = "sign",
	Register = "register",
}

export type LandError = { kind: Failure; code: string };

const parseCreated = (raw: unknown): object | undefined =>
	isRecord(raw) ? raw : undefined;

const signFailure = (code: string): LandError => ({
	kind: code === "no_wallet" ? Failure.NoWallet : Failure.Sign,
	code,
});

export const useRegister = () => {
	const { me, signIn, refresh } = useSession();
	const [busy, setBusy] = useState(Busy.Idle);
	const [error, setError] = useState<LandError | undefined>(undefined);

	const ensureSession = async (signing: Busy): Promise<boolean> => {
		if (me !== null) {
			return true;
		}
		setBusy(signing);
		const failed = await signIn();
		if (failed === undefined) {
			return true;
		}
		setError(signFailure(failed));
		setBusy(Busy.Idle);

		return false;
	};

	const registerFirm = async (name: string) => {
		setError(undefined);
		if (me?.firm) {
			navigate("/firm");
			return;
		}
		if (!(await ensureSession(Busy.SignFirm))) {
			return;
		}
		setBusy(Busy.RegisterFirm);
		const body = { name: name.trim() || "My firm" };
		const res = await request("POST", "/api/firm", body, parseCreated);
		if (!res.ok && res.status !== 409) {
			const code = res.error.message ?? res.error.error;
			setError({ kind: Failure.Register, code });
			setBusy(Busy.Idle);
			return;
		}
		await refresh();
		navigate("/firm");
	};

	const registerAgency = async () => {
		setError(undefined);
		if (!(await ensureSession(Busy.SignAgency))) {
			return;
		}
		navigate("/agency");
	};

	return { busy, error, registerFirm, registerAgency };
};
