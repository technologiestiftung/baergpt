import { useEffect, useState } from "react";
import type { Sheet } from "../types.ts";
import { parseWorkbook } from "../parse-workbook.ts";
import { useErrorStore } from "../../../store/error-store.ts";

export function useSpreadsheet(downloadUrl: string) {
	const [sheets, setSheets] = useState<Sheet[]>([]);
	const [activeSheetIndex, setActiveSheetIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [truncated, setTruncated] = useState(false);

	// Download file
	useEffect(() => {
		setIsLoading(true);
		const abortController = new AbortController();

		(async () => {
			try {
				// `downloadUrl` is a "blob:<URL>" of the file the preview store already
				// downloaded, so this resolves from memory without a network request.
				const response = await fetch(downloadUrl, {
					signal: abortController.signal,
				});
				const blob = await response.blob();
				const parsed = await parseWorkbook(blob);

				if (abortController.signal.aborted) {
					return;
				}

				setSheets(parsed.sheets);
				setTruncated(parsed.truncated);
			} catch (error) {
				if (!abortController.signal.aborted) {
					useErrorStore.getState().handleError(error as Error);
				}
			} finally {
				/**
				 * if the signal was aborted, there is a chance a user opened a different
				 * preview. This can lead to a race condition where isLoading will be set
				 * to false, while still loading the latest preview. So we only reset
				 * isLoading when the request was not aborted.
				 */
				if (!abortController.signal.aborted) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			abortController.abort();
			setSheets([]);
			setTruncated(false);
			setActiveSheetIndex(0);
			setIsLoading(false);
		};
	}, [downloadUrl]);

	return {
		sheets,
		activeSheetIndex,
		setActiveSheetIndex,
		isLoading,
		truncated,
	};
}
