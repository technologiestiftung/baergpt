import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";
import type { SourceType } from "../../common.ts";

export async function getDocumentObjectUrl({
	sourceUrl,
	sourceType,
	previewSourceUrl,
}: {
	sourceUrl: string;
	sourceType: SourceType;
	previewSourceUrl?: string | null;
}): Promise<string | undefined> {
	const bucket = ["public_document", "default_document"].includes(sourceType)
		? "public_documents"
		: "documents";

	const resolvedPreviewSourceUrl =
		previewSourceUrl ?? deriveLegacyPreviewSourceUrl(sourceUrl);

	const { data: previewBlob, error: previewError } = await supabase.storage
		.from(bucket)
		.download(resolvedPreviewSourceUrl);

	if (previewError) {
		useErrorStore.getState().handleError(previewError);
		return undefined;
	}

	return URL.createObjectURL(previewBlob);
}

/**
 * Only used for documents processed before UUID-named previews existed
 * (preview_source_url is null on their row): for docx files, the PDF
 * preview lives at the same path with the extension swapped.
 */
export function deriveLegacyPreviewSourceUrl(sourceUrl: string) {
	if (sourceUrl.toLowerCase().endsWith(".docx")) {
		return sourceUrl.replace(/\.docx$/i, ".pdf");
	}
	return sourceUrl;
}
