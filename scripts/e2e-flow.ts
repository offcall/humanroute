// Devnet e2e of the v2 money path against a running gateway: SIWS sign-in for firm, agency and
// linguist, order, x402 payment, claim, approve, reject, payout and refunds, on-chain checks.
// Env: GATEWAY_URL, AGENT_KEYPAIR_PATH (firm = agent wallet), FEE_WALLET, RPC_URL, USDC_MINT.
import { generateKeyPairSigner } from "@solana/kit";
import { Connection } from "@solana/web3.js";
import { loadSigner } from "../agent/keypair.js";
import { registerAccounts } from "./e2e/accounts.js";
import { preflight } from "./e2e/chain.js";
import { createAndPay } from "./e2e/pay.js";
import { chainChecks, printSummary, ratingChecks } from "./e2e/report.js";
import { signIn } from "./e2e/siws.js";
import { decideTask, readTasks, waitFinal, workTask } from "./e2e/tasks.js";

const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

const required = (name: string): string => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
};

const optional = (name: string, fallback: string): string =>
	process.env[name] || fallback;

const taskIdOf = (
	tasks: { taskId: string; targetLang: string }[],
	lang: string,
): string => {
	const found = tasks.find((task) => task.targetLang === lang);
	if (!found) {
		throw new Error(`no ${lang} task in the order`);
	}
	return found.taskId;
};

const main = async (): Promise<number> => {
	const gateway = required("GATEWAY_URL").replace(/\/$/, "");
	const fee = required("FEE_WALLET");
	const mint = optional("USDC_MINT", DEVNET_USDC);
	const connection = new Connection(
		optional("RPC_URL", "https://api.devnet.solana.com"),
		"confirmed",
	);
	const agent = await loadSigner(required("AGENT_KEYPAIR_PATH"));
	if (!(await preflight(connection, agent.address, mint))) {
		return 1;
	}

	const agency = await generateKeyPairSigner();
	const linguist = await generateKeyPairSigner();
	console.log(
		`firm/agent ${agent.address} agency ${agency.address} linguist ${linguist.address}`,
	);
	const jars = {
		firm: await signIn(gateway, agent),
		agency: await signIn(gateway, agency),
		linguist: await signIn(gateway, linguist),
	};
	const accounts = await registerAccounts(gateway, jars);
	const receipt = await createAndPay(gateway, accounts.mcpToken, agent);

	const open = await readTasks(gateway, jars.firm, receipt.orderId);
	const esId = taskIdOf(open, "es");
	const frId = taskIdOf(open, "fr");
	await workTask(gateway, jars.linguist, esId);
	await workTask(gateway, jars.linguist, frId);
	await decideTask(gateway, jars.firm, esId, true);
	await decideTask(gateway, jars.firm, frId, false);

	const tasks = await waitFinal(gateway, jars.firm, receipt.orderId);
	const parties = {
		agent: agent.address,
		linguist: linguist.address,
		agency: agency.address,
		fee,
	};
	const checks = [
		...(await chainChecks(
			connection,
			mint,
			parties,
			new Map(tasks.map((task) => [task.targetLang, task])),
			receipt.payTx,
		)),
		...(await ratingChecks(gateway, accounts.agencyId, accounts.firmId)),
	];
	printSummary(receipt.payTx, tasks, checks);

	const failed = checks.filter((item) => !item.ok);
	console.log(
		failed.length === 0
			? "PASS"
			: `FAIL: ${failed.map((item) => item.name).join("; ")}`,
	);
	return failed.length === 0 ? 0 : 1;
};

main()
	.then((code) => process.exit(code))
	.catch((err: unknown) => {
		console.error(
			`e2e-flow: ${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	});
