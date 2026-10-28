import type { SliceDefinition } from "../store/index.js";
import { AUTH_SCHEMA_SQL } from "./sql.js";

export const authSlice: SliceDefinition = {
	slice: "auth",
	migrations: [{ version: "0001", sql: AUTH_SCHEMA_SQL }],
};
