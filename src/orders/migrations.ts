import type { SliceDefinition } from "../store/index.js";
import { ORDERS_SCHEMA_SQL } from "./sql.js";

export const ordersSlice: SliceDefinition = {
	slice: "orders",
	migrations: [{ version: "0001", sql: ORDERS_SCHEMA_SQL }],
};
