import { useEffect, useState } from "react";
import type { MatomoDashboardStats } from "@/components/charts/types.ts";
import { getMatomoStats } from "@/api/product-dashboard/get-matomo-stats.ts";
import { useAuthStore } from "@/store/use-auth-store.ts";

export function useMatomoDashboardData() {
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [dataState, setDataState] = useState<MatomoDashboardStats | null>(null);
	const [errorState, setErrorState] = useState<Error | null>(null);
	const hasSession = useAuthStore((state) => !!state.session);

	const resetState = () => {
		setIsLoading(true);
		setDataState(null);
		setErrorState(null);
	};

	useEffect(() => {
		// Wait until the auth session is restored; getMatomoStats needs its access token.
		if (!hasSession) {
			return undefined;
		}

		const abortController = new AbortController();

		resetState();

		getMatomoStats(abortController.signal).then(({ data, error }) => {
			setIsLoading(false);

			if (abortController.signal.aborted) {
				return;
			}

			if (error) {
				console.error(error);
				setErrorState(error);
				return;
			}

			setDataState(data);
		});

		return () => {
			abortController.abort();
		};
	}, [hasSession]);

	return { data: dataState, isLoading, error: errorState };
}
