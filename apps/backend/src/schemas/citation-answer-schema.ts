import { z } from "zod/v4";

export const citationAnswerSchema = (maxAvailableSources: number) =>
	z.object({
		content: z.string().describe("Antwort auf die Nutzeranfrage"),
		citations: z
			.array(
				z
					.number()
					.describe("Einzigartige ID des Textabschnitts im Datenbanksystem"),
			)
			.max(maxAvailableSources)
			.refine(
				(citations) => {
					const uniqueCitationKeys = new Set(citations);
					return citations.length === uniqueCitationKeys.size;
				},
				{
					message: "Citations array darf keine doppelten Einträge enthalten",
				},
			)
			.describe(
				`Array von Zitaten, die für die Erstellung der Antwort verwendet wurden. Verwende keine Quelle doppelt. Du kannst weniger als ${maxAvailableSources} Quellen verwenden, aber NIEMALS mehr.`,
			),
	});
