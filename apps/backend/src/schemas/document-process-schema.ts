import { z } from "zod";
import { allowedSourceTypes } from "../constants";

/**
 * Schema for the document object in process requests.
 * Note: owned_by_user_id is accepted but will be overridden server-side.
 */
export const documentProcessSchema = z.object({
	document: z.object({
		folderId: z.number().int().positive().nullable(),
		sourceType: z.enum(allowedSourceTypes),
		accessGroupId: z.uuid().nullable().optional(),
	}),
	llmModel: z.string().min(1, "llm_model is required"),
});

export type DocumentProcessInput = z.infer<typeof documentProcessSchema>;
