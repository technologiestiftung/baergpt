import { z } from "zod";

export const citationAnswerSchema = z.object({
	citations: z
		.array(z.number().describe("ID des Textabschnitts"))
		.describe(
			"Array der IDs von Quellen, die tatsächlich in der Antwort verwendet wurden.",
		),
});
