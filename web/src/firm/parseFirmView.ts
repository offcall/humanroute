import { isRecord, parseFirm, str } from "../shared";
import type { FirmView } from "./types";

// GET /api/firm
export const parseFirmView = (raw: unknown): FirmView | undefined => {
	if (!isRecord(raw) || !isRecord(raw.mcp)) {
		return undefined;
	}
	const firm = parseFirm(raw.firm);
	const url = str(raw.mcp.url);
	const token = str(raw.mcp.token);
	if (firm === undefined || url === undefined || token === undefined) {
		return undefined;
	}

	return { firm, mcp: { url, token } };
};
