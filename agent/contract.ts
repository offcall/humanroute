// Hardcoded demo contract: three sentences with a fake MT draft and its confidence.
import type { Sentence } from "./types.js";

export const CONTRACT: readonly [Sentence, ...Sentence[]] = [
	{
		id: "c1",
		text: "This Agreement is entered into on the date of the last signature below.",
		draft:
			"Dieser Vertrag wird am Datum der letzten Unterschrift unten geschlossen.",
		confidence: 0.94,
	},
	{
		id: "c2",
		text: "The Supplier shall indemnify the Client against all claims arising from latent defects.",
		draft:
			"Der Lieferant soll den Kunden gegen alle Ansprüche aus versteckten Mängeln entschädigen.",
		confidence: 0.58,
	},
	{
		id: "c3",
		text: "This Agreement is governed by the laws of Germany.",
		draft:
			"Dieser Vertrag unterliegt dem Recht der Bundesrepublik Deutschland.",
		confidence: 0.97,
	},
];

export const leastConfident = (
	sentences: readonly [Sentence, ...Sentence[]],
): Sentence =>
	sentences.reduce((best, next) =>
		next.confidence < best.confidence ? next : best,
	);
