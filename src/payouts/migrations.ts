import type { SliceDefinition } from "../store/index.js";
import { PAYOUTS_SCHEMA_SQL } from "./sql.js";

export const payoutsSlice: SliceDefinition = {
	slice: "payouts",
	migrations: [{ version: "0001", sql: PAYOUTS_SCHEMA_SQL }],
};
