import { z } from "zod";

export const citationAnswerSchema = z.object({
	citations: z
		.array(z.number().describe("ID des Textabschnitts"))
		.describe(
			"Array der IDs von Quellen, die tatsächlich in der Antwort verwendet wurden.",
		),
});

export const webCitationAnswerSchema = z.object({
    citations: z.array(z.object({
        url: z.string().describe("URL der Webquelle"),
        title: z.string().describe("Titel der Webquelle"),
        hostname: z.string().describe("Hostname der Webquelle"),
		snippet: z.string().describe("Snippet der Webquelle"),
    })).describe(
        "Array der Webquellen, die tatsächlich in der Antwort verwendet wurden.",
    ),
});
