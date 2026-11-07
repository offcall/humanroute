// One paid LEAFLET order (es, fr) with a firm, an agency and a linguist, through the /api routes.
import { createTestGateway, type TestGateway } from "./gateway.js";
import { expectJson, listField, send, textField } from "./http.js";
import { createDraft, payDraft, paymentFor } from "./orders.js";
import {
	joinLinguist,
	type LanguagePair,
	registerAgency,
	registerFirm,
	type TestAgency,
	type TestFirm,
} from "./people.js";
import { settleAs } from "./settle.js";
import { type TestWallet, WALLETS } from "./wallets.js";

export type Scene = TestGateway &
	PaidTasks & { firm: TestFirm; agency: TestAgency; linguist: string };

export type SceneOptions = {
	pairs?: LanguagePair[];
	payer?: TestWallet;
	memo?: string;
};

export const EN_ES_FR: LanguagePair[] = [
	{ source: "en", target: "es" },
	{ source: "en", target: "fr" },
];

export type PaidTasks = {
	draftId: string;
	orderId: string;
	es: string;
	fr: string;
};

// Pays a new LEAFLET draft of the firm as `payer`; returns the order and its task ids.
export const payOrder = async (
	gateway: TestGateway,
	firm: TestFirm,
	memo: string,
	payer = WALLETS.firm,
): Promise<PaidTasks> => {
	const { app } = gateway;
	const draftId = textField(await createDraft(app, firm.mcpToken), "draftId");
	const header = await paymentFor(app, draftId, payer, memo);
	const paid = await expectJson(await payDraft(app, draftId, header), 201);
	const orderId = textField(paid, "orderId");
	const order = await expectJson(
		await send(app, "GET", `/api/orders/${orderId}`, { bearer: firm.mcpToken }),
		200,
	);
	const idOf = (lang: string) =>
		textField(
			listField(order, "tasks").find((task) => task.targetLang === lang) ?? {},
			"taskId",
		);

	return { draftId, orderId, es: idOf("es"), fr: idOf("fr") };
};

export const paidOrder = async (
	options: SceneOptions = {},
	gateway = createTestGateway(),
): Promise<Scene> => {
	const { app } = gateway;
	const payer = options.payer ?? WALLETS.firm;
	const firm = await registerFirm(app, WALLETS.firm);
	const agency = await registerAgency(app, WALLETS.agency);
	const linguist = await joinLinguist(
		app,
		WALLETS.linguist,
		agency.inviteCode,
		options.pairs ?? EN_ES_FR,
	);
	if (payer !== WALLETS.firm) {
		settleAs(gateway, payer);
	}
	const tasks = await payOrder(gateway, firm, options.memo ?? "order-1", payer);

	return { ...gateway, firm, agency, linguist, ...tasks };
};
