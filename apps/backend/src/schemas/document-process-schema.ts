import { z } from "zod";
import { allowedSourceTypes } from "../constants";

/**
 * Schema for validating source_url to prevent path traversal attacks.
 * Valid patterns: "{uuid}/{filename}" or "{uuid}/{filename.ext}"
 * Invalid patterns: "../", "./", "//", absolute paths, etc.
 */
const sourceUrlSchema = z
	.string()
	.min(1, "source_url is required")
	.refine(
		(url) => {
			// Check for path traversal patterns
			if (url.includes("..") || url.includes("./")) {
				return false;
			}
			// Check for double slashes
			if (url.includes("//")) {
				return false;
			}
			// Check for absolute paths
			if (url.startsWith("/")) {
				return false;
			}
			// Must have at least one slash (user_id/filename pattern)
			if (!url.includes("/")) {
				return false;
			}
			// Must not end with a slash
			if (url.endsWith("/")) {
				return false;
			}
			return true;
		},
		{
			message:
				"Invalid source_url format: must be a valid relative path without traversal patterns",
		},
	);

/**
 * Schema for the document object in process requests.
 * Note: owned_by_user_id is accepted but will be overridden server-side.
 */
export const documentProcessSchema = z.object({
	document: z.object({
		id: z.null().optional(),
		file_name: z.string().optional(),
		folder_id: z.number().int().positive().nullable().optional(),
		// Accept from client but will be overridden with authenticated user ID
		owned_by_user_id: z.string().optional(),
		created_at: z.iso.datetime().optional(),
		source_type: z.enum(allowedSourceTypes),
		source_url: sourceUrlSchema,
		// Optional metadata - not stored directly, used for client-side info
		metadata: z
			.object({
				mimeType: z.string().optional(),
				size: z.number().optional(),
			})
			.optional(),
		// Access group for public/default documents
		access_group_id: z.uuid().nullable().optional(),
		uploaded_by_user_id: z.uuid().nullable().optional(),
	}),
});

export type DocumentProcessInput = z.infer<typeof documentProcessSchema>;
