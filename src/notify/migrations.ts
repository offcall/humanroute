import type { SliceDefinition } from "../store/index.js";
import { NOTIFY_SCHEMA_SQL } from "./sql.js";

export const notifySlice: SliceDefinition = {
	slice: "notify",
	migrations: [{ version: "0001", sql: NOTIFY_SCHEMA_SQL }],
};
