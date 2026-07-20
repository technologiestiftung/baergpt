import { supabase } from "../../../supabase-client";
import type { ProductDashboardStats } from "@/components/charts/types.ts";

export async function getData(
	signal: AbortSignal,
): Promise<
	{ data: ProductDashboardStats; error: null } | { data: null; error: Error }
> {
	const { data, error } = await supabase
		.rpc("get_product_dashboard_stats")
		.abortSignal(signal);

	if (signal.aborted) {
		return { data: null, error: new Error("Request aborted") };
	}

	if (error) {
		return { data: null, error };
	}

	return { data: data as ProductDashboardStats, error: null };
}
