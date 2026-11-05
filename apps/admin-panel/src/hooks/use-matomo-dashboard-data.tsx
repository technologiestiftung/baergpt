import { useEffect, useState } from "react";
import type { MatomoDashboardStats } from "@/components/charts/types.ts";
import { getMatomoStats } from "@/api/product-dashboard/get-matomo-stats.ts";

export function useMatomoDashboardData() {
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [dataState, setDataState] = useState<MatomoDashboardStats | null>(null);
	const [errorState, setErrorState] = useState<Error | null>(null);

	const resetState = () => {
		setIsLoading(true);
		setDataState(null);
		setErrorState(null);
	};

	useEffect(() => {
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
	}, []);

	return { data: dataState, isLoading, error: errorState };
}
