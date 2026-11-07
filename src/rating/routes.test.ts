// Public rating routes (ADR 0025): counts from tasks, money from confirmed payouts only.
import { describe, expect, test } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	joinLinguist,
	listField,
	payDraft,
	paymentFor,
	registerAgency,
	registerFirm,
	send,
	textField,
	WALLETS,
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

	test("money fields count only confirmed transfers and are decimal strings", async () => {
		const gateway = createTestGateway();
		const { app, chain } = gateway;
		const firm = await registerFirm(app, WALLETS.firm);
		const agency = await registerAgency(app, WALLETS.agency);
		const cookie = await joinLinguist(
			app,
			WALLETS.linguist,
			agency.inviteCode,
			[
				{ source: "en", target: "es" },
				{ source: "en", target: "fr" },
			],
		);
		const draftId = textField(await createDraft(app, firm.mcpToken), "draftId");
		const header = await paymentFor(app, draftId, WALLETS.firm, "rating");
		const paid = await expectJson(await payDraft(app, draftId, header), 201);
		const orderPath = `/api/orders/${textField(paid, "orderId")}`;
		const order = await expectJson(
			await send(app, "GET", orderPath, { bearer: firm.mcpToken }),
			200,
		);
		const [es, fr] = listField(order, "tasks").map((task) =>
			textField(task, "taskId"),
		);
		for (const taskId of [es, fr]) {
			await expectJson(
				await send(app, "POST", `/api/tasks/${taskId}/claim`, {
					cookie,
					body: {},
				}),
				200,
			);
			await expectJson(
				await send(app, "POST", `/api/tasks/${taskId}/submit`, {
					cookie,
					body: { result: "ok" },
				}),
				200,
			);
		}
		const bearer = firm.mcpToken;
		await expectJson(
			await send(app, "POST", `/api/tasks/${es}/approve`, { bearer }),
			200,
		);
		await expectJson(
			await send(app, "POST", `/api/tasks/${fr}/reject`, {
				bearer,
				body: { reason: "wrong" },
			}),
			200,
		);

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
		const unpaid = {
			agency: { ...counted.agency, paidUnits: "0" },
			firm: { ...counted.firm, spentUnits: "0", refundedUnits: "0" },
		};

		expect(await ratings()).toMatchObject(unpaid);

		chain.answer.signatureStatus = async () => ({
			ok: true,
			value: { state: "pending" },
		});
		await gateway.worker.tick();
		await gateway.worker.tick();
		expect(chain.calls.some((call) => call.method === "broadcast")).toBe(true);
		expect(await ratings()).toMatchObject(unpaid);

		chain.answer.signatureStatus = async () => ({
			ok: true,
			value: { state: "confirmed" },
		});
		for (let tick = 0; tick < 5; tick += 1) {
			await gateway.worker.tick();
		}
		expect(await ratings()).toMatchObject({
			agency: { ...counted.agency, paidUnits: "90000" },
			firm: { ...counted.firm, spentUnits: "500000", refundedUnits: "500000" },
		});
	});
});
