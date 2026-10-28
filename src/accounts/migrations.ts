import type { SliceDefinition } from "../store/index.js";
import { ACCOUNTS_SCHEMA_SQL } from "./sql.js";

export const accountsSlice: SliceDefinition = {
	slice: "accounts",
	migrations: [{ version: "0001", sql: ACCOUNTS_SCHEMA_SQL }],
};
