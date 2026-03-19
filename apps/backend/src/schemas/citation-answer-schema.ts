import { z } from "zod";

export const citationAnswerSchema = z.object({
	content: z
		.string()
		.describe(
			"Antwort auf die Nutzeranfrage mit Quellenverweisen. Nummeriere Zitate STRIKT aufsteigend [1], [2], [3], etc. OHNE Sprünge. Platziere die Zitatnummern NACH dem Ende des jeweiligen Satzes. Jede neue Quelle erhält die nächsthöhere Nummer.",
		),
	citations: z
		.array(z.number().describe("ID des Textabschnitts"))
		.describe(
			"Array der IDs von Quellen in der Reihenfolge ihrer Nummerierung im Text ([1] = Index 0, [2] = Index 1, etc.).",
		),
});

export const webCitationAnswerSchema = z.object({
	citations: z
		.array(
			z.object({
				url: z.string().describe("URL der Webquelle"),
				title: z.string().describe("Titel der Webquelle"),
				snippet: z.string().describe("Snippet der Webquelle"),
			}),
		)
		.describe(
			"Array der Webquellen, die tatsächlich in der Antwort verwendet wurden.",
		),
});
