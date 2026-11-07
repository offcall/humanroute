// Public rating routes (ADR 0025): counts from tasks, money from confirmed payouts only.
import { describe, expect, test } from "vitest";
import {
	approve,
	createTestGateway,
	expectJson,
	paidOrder,
	reject,
	send,
	submitted,
} from "../testing/index.js";

const UNKNOWN = "00000000-0000-4000-8000-00000000abcd";

describe("rating routes", () => {
	test("rating routes answer zeros and null for unknown ids and 422 for non-UUID ids", async () => {
		const { app } = createTestGateway();

		const agency = await send(app, "GET", `/api/rating/agency/${UNKNOWN}`);
		expect(await expectJson(agency, 200)).toEqual({
			agencyId: UNKNOWN,
			ratingPct: null,
			approved: 0,
			rejected: 0,
			late: 0,
			paidUnits: "0",
		});
		const firm = await send(app, "GET", `/api/rating/firm/${UNKNOWN}`);
		expect(await expectJson(firm, 200)).toEqual({
			firmId: UNKNOWN,
			rejectPct: null,
			approved: 0,
			rejected: 0,
			spentUnits: "0",
			refundedUnits: "0",
		});

		for (const path of ["agency", "firm"]) {
			for (const id of ["nope", UNKNOWN.toUpperCase(), `${UNKNOWN}0`]) {
				const res = await send(app, "GET", `/api/rating/${path}/${id}`);
				expect(await expectJson(res, 422)).toEqual({ error: "invalid_id" });
			}
		}
	});

	test("ratings count decisions and money fields are confirmed decimal strings", async () => {
		const scene = await paidOrder({ memo: "rating" });
		const { app, agency, firm, es, fr } = scene;
		await submitted(scene, [es, fr]);
		const bearer = firm.mcpToken;
		await expectJson(await approve(scene, es, { bearer }), 200);
		await expectJson(await reject(scene, fr, { bearer }, { reason: "x" }), 200);

		const ratings = async () => ({
			agency: await expectJson(
				await send(app, "GET", `/api/rating/agency/${agency.agencyId}`),
				200,
			),
			firm: await expectJson(
				await send(app, "GET", `/api/rating/firm/${firm.firmId}`),
				200,
			),
		});
		const counted = {
			agency: { approved: 1, rejected: 1, late: 0, ratingPct: 50 },
			firm: { approved: 1, rejected: 1, rejectPct: 50 },
		};

		expect(await ratings()).toMatchObject({
			agency: { ...counted.agency, paidUnits: "0" },
			firm: { ...counted.firm, spentUnits: "0", refundedUnits: "0" },
		});
		for (let tick = 0; tick < 5; tick += 1) {
			await scene.worker.tick();
		}
		expect(await ratings()).toMatchObject({
			agency: { ...counted.agency, paidUnits: "90000" },
			firm: { ...counted.firm, spentUnits: "500000", refundedUnits: "500000" },
		});
	});
});
