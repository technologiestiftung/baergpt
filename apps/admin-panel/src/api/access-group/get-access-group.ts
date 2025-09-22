import { supabase } from "../../../supabase-client";

export async function getAccessGroup(
	signal: AbortSignal,
): Promise<{ id: string }> {
	const { data, error } = await supabase
		.from("access_groups")
		.select("id")
		.limit(1) // Select only the first row
		.abortSignal(signal);
	if (signal.aborted) {
		return { id: "" };
	}

	if (error) {
		console.error("Error fetching access groups:", error);
		return { id: "" };
	}

	return { id: data && data.length > 0 ? data[0].id : "" };
}
