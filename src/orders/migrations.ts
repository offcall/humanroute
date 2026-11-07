import type { SliceDefinition } from "../store/index.js";
import { ORDERS_SCHEMA_SQL, ORPHAN_DRAFT_SQL } from "./sql.js";

export const ordersSlice: SliceDefinition = {
	slice: "orders",
	migrations: [
		{ version: "0001", sql: ORDERS_SCHEMA_SQL },
		{ version: "0002", sql: ORPHAN_DRAFT_SQL },
	],
};
