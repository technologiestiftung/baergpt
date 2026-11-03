import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";
import type { SourceType } from "../../common.ts";

export async function downloadDocument({
	sourceUrl,
	sourceType,
}: {
	sourceUrl: string;
	sourceType: SourceType;
}): Promise<Blob | undefined> {
	const bucket = ["public_document", "default_document"].includes(sourceType)
		? "public_documents"
		: "documents";

	try {
		const { data: downloadBlob, error: downloadError } = await supabase.storage
			.from(bucket)
			.download(sourceUrl);

		if (downloadError) {
			throw downloadError;
		}

		return downloadBlob;
	} catch (error) {
		useErrorStore.getState().handleError(error);
		return undefined;
	}
}
