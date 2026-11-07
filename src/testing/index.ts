// Gateway test support (ADR 0037). Imported only by *.test.ts files, never by production code.

export { ErrorKind } from "../chain/index.js";
export {
	type ChainCall,
	chainFail,
	chainOk,
	FAKE_BLOCKHASH,
	type FakeChain,
	fakeChain,
} from "./chain.js";
export { START, sequentialIds, type TestClock, testClock } from "./clock.js";
export { type FakeFacilitator, fakeFacilitator } from "./facilitator.js";
export { createTestGateway, type TestGateway, testConfig } from "./gateway.js";
export {
	expectJson,
	type Json,
	listField,
	objectField,
	type SendOptions,
	send,
	textField,
} from "./http.js";
export { createDraft, LEAFLET, payDraft, paymentFor } from "./orders.js";
export { type Offer, paymentHeader, readOffer } from "./payment.js";
export {
	joinLinguist,
	type LanguagePair,
	registerAgency,
	registerFirm,
	type TestAgency,
	type TestFirm,
} from "./people.js";
export { signIn } from "./session.js";
export { type TestWallet, testWallet, WALLETS } from "./wallets.js";
