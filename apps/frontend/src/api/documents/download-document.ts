import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";
import { SourceType } from "../../common.ts";

export async function downloadDocument({
	sourceUrl,
	sourceType,
}: {
	sourceUrl: string;
	sourceType: SourceType;
}): Promise<Blob | undefined> {
	const bucket =
		sourceType === "public_document" ? "public_documents" : "documents";

	const { data: downloadBlob, error: downloadError } = await supabase.storage
		.from(bucket)
		.download(sourceUrl);

	if (downloadError) {
		useErrorStore.getState().handleError(downloadError);
		return undefined;
	}

	return downloadBlob;
}
