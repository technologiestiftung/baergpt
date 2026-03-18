import { useEffect, useState } from "react";
import type { ProductDashboardStats } from "@/components/charts/types.ts";
import { getData } from "@/api/product-dashboard/get-data.ts";

export function useProductDashboardData() {
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [dataState, setDataState] = useState<ProductDashboardStats | null>(
		null,
	);
	const [errorState, setErrorState] = useState<Error | null>(null);

	const resetState = () => {
		setIsLoading(true);
		setDataState(null);
		setErrorState(null);
	};

	useEffect(() => {
		const abortController = new AbortController();

		resetState();

		getData(abortController.signal).then(({ data, error }) => {
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
