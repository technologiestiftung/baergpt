import { useAuthStore } from "../../store/use-auth-store.ts";
import type { MatomoDashboardStats } from "@/components/charts/types.ts";

export async function getMatomoStats(
	signal: AbortSignal,
): Promise<
	{ data: MatomoDashboardStats; error: null } | { data: null; error: Error }
> {
	const url = `${import.meta.env.VITE_API_URL}/admin/matomo-stats`;

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${useAuthStore.getState().session?.access_token}`,
			},
			signal,
		});

		if (signal.aborted) {
			return { data: null, error: new Error("Request aborted") };
		}

		if (!response.ok) {
			return {
				data: null,
				error: new Error(`Failed to fetch Matomo stats: ${response.status}`),
			};
		}

		const data = (await response.json()) as MatomoDashboardStats;
		return { data, error: null };
	} catch (error) {
		if (signal.aborted) {
			return { data: null, error: new Error("Request aborted") };
		}
		return {
			data: null,
			error: error instanceof Error ? error : new Error("Unknown error"),
		};
	}
}
