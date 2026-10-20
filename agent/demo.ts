// Demo agent: "translates" a 3-sentence contract with a fake MT and escalates the least confident
// sentence to a human over x402. Usage: npx tsx agent/demo.ts [--silent]
// --silent: the expert is not expected to answer; waits for the SLA refund and exits 1 without one.
import { CONTRACT, leastConfident } from "./contract.js";
import { escalateToHuman } from "./escalate.js";
import { gatewayUrl, inboxUrl } from "./gateway.js";
import {
	explorerTx,
	printFinal,
	progressLine,
	statusViewUrl,
} from "./report.js";
import { pollStatus } from "./status.js";

const main = async (): Promise<boolean> => {
	const silent = process.argv.includes("--silent");
	const gateway = gatewayUrl();
	console.log(
		`gateway: ${gateway}${silent ? "  (silent mode: expert will not answer)" : ""}\n`,
	);
	for (const sentence of CONTRACT) {
		console.log(
			`[${sentence.id}] conf=${sentence.confidence.toFixed(2)}  ${sentence.draft}`,
		);
	}

	const worst = leastConfident(CONTRACT);
	console.log(
		`\nescalating ${worst.id} (conf ${worst.confidence.toFixed(2)}) to a human via x402...`,
	);
	const escalation = await escalateToHuman({
		gatewayUrl: gateway,
		keypairPath: process.env.AGENT_KEYPAIR_PATH || "keys/agent.json",
		text: worst.text,
		sourceLang: "en",
		targetLang: "de",
		draft: worst.draft,
	});
	console.log(
		`paid. jobId=${escalation.jobId} payer=${escalation.payer ?? "?"}`,
	);
	if (escalation.payTx) {
		console.log(`payment tx: ${explorerTx(escalation.payTx)}`);
	}
	console.log(`status:     ${escalation.statusUrl}`);
	console.log(`status UI:  ${statusViewUrl(escalation.statusUrl)}`);
	console.log(`inbox:      ${inboxUrl(gateway)}`);
	console.log(
		silent ? "waiting for the SLA refund..." : "waiting for the expert...",
	);

	const startedAt = Date.now();
	let last = "";
	const final = await pollStatus(escalation.statusUrl, {
		onTick: (status) => {
			const line = progressLine(status);
			if (line !== last) {
				const elapsed = Math.round((Date.now() - startedAt) / 1000);
				console.log(`  +${elapsed}s ${line}`);
			}
			last = line;
		},
	});
	printFinal(final, escalation.payTx);

	console.log("\nfinal translation:");
	for (const sentence of CONTRACT) {
		const human = sentence.id === worst.id && final.answer !== null;
		console.log(`  ${human ? final.answer : sentence.draft}`);
	}

	if (!silent) {
		return true;
	}
	return (
		final.state === "refunded" &&
		final.transfers.some(
			(transfer) =>
				transfer.kind === "refund" && transfer.status === "confirmed",
		)
	);
};

main().then(
	(success) => process.exit(success ? 0 : 1),
	(err: unknown) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	},
);
