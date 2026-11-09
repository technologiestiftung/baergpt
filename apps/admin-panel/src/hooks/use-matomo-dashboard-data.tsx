import { getMatomoStats } from "@/api/product-dashboard/get-matomo-stats.ts";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch.tsx";
import { useAuthStore } from "@/store/use-auth-store.ts";

export function useMatomoDashboardData() {
	// Wait until the auth session is restored; getMatomoStats needs its access token.
	const hasSession = useAuthStore((state) => !!state.session);

	return useAbortableFetch(getMatomoStats, hasSession);
}
