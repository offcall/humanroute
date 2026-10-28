import type { SliceDefinition } from "../store/index.js";
import { TASKS_SCHEMA_SQL } from "./sql.js";

export const tasksSlice: SliceDefinition = {
	slice: "tasks",
	migrations: [{ version: "0001", sql: TASKS_SCHEMA_SQL }],
};
