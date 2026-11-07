// Registers an afterEach that captures the pages of a failed browser case (see Session.capture).
import { afterEach } from "vitest";
import type { Session } from "./browser.js";

export const captureFailures = (session: () => Session | undefined): void => {
	afterEach(async (context) => {
		if (context.task.result?.state === "fail") {
			await session()?.capture(context.task.name.slice(0, 40));
		}
	});
};
