import { z } from "zod";

export const streamedObjectSchema = z.object({
	content: z.string(),
	citations: z.array(z.number()).optional(),
});

export type StreamedObject = z.infer<typeof streamedObjectSchema>;
