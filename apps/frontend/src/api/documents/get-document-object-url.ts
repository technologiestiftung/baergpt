import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";
import type { SourceType } from "../../common.ts";

export async function getDocumentObjectUrl({
	sourceUrl,
	sourceType,
}: {
	sourceUrl: string;
	sourceType: SourceType;
}): Promise<string | undefined> {
	const bucket =
		sourceType === "public_document" ? "public_documents" : "documents";

	const previewSourceUrl = getPreviewSourceUrl(sourceUrl);

	const { data: previewBlob, error: previewError } = await supabase.storage
		.from(bucket)
		.download(previewSourceUrl);

	if (previewError) {
		useErrorStore.getState().handleError(previewError);
		return undefined;
	}

	return URL.createObjectURL(previewBlob);
}

function getPreviewSourceUrl(sourceUrl: string) {
	/**
	 * For docx files, use the PDF preview version instead,
	 * to ensure it is viewable with the browser PDF viewer.
	 */
	if (sourceUrl.toLowerCase().endsWith(".docx")) {
		return sourceUrl.replace(/\.docx$/i, ".pdf");
	}
	return sourceUrl;
}
