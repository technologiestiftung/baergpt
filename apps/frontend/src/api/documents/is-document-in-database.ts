import { supabase } from "../../../supabase-client.ts";

export async function isDocumentInDatabase(filePath: string) {
	const { count, error } = await supabase
		.from("documents")
		.select("source_url", { count: "exact", head: true })
		.eq("source_url", filePath);

	if (error) {
		return { data: null, error };
	}

	if (typeof count === "number" && count > 1) {
		return {
			data: null,
			error: new Error(
				`Multiple documents found with the same source_url: ${filePath}`,
			),
		};
	}

	return { data: count === 1, error: null };
}
