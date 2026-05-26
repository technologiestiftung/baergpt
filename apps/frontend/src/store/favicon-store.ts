import { create } from "zustand";
import { useAuthStore } from "./auth-store";
import { captureError } from "../monitoring/capture-error";

type FaviconStore = {
	faviconByHostname: Record<string, string>;
	ensureFaviconsCached: (urls: string[]) => Promise<void>;
};

export const useFaviconStore = create<FaviconStore>()((set, get) => ({
	faviconByHostname: {},

	async ensureFaviconsCached(urls) {
		const { faviconByHostname } = get();
		const token = useAuthStore.getState().session?.access_token;
		if (!token) {
			return;
		}

		const missing = [
			...new Set(
				urls.flatMap((url) => {
					try {
						return [new URL(url).hostname];
					} catch (error) {
						captureError(error);
						return [];
					}
				}),
			),
		].filter((h) => !faviconByHostname[h]);

		if (missing.length === 0) {
			return;
		}

		const results = await Promise.all(
			missing.map(async (hostname) => {
				try {
					const response = await fetch(
						`${import.meta.env.VITE_API_URL}/favicon?domain=${encodeURIComponent(hostname)}`,
						{ headers: { Authorization: `Bearer ${token}` } },
					);
					if (!response.ok) {
						return null;
					}
					const blob = await response.blob();
					return { hostname, url: URL.createObjectURL(blob) };
				} catch {
					return null;
				}
			}),
		);

		const merged = { ...faviconByHostname };
		for (const result of results) {
			if (result) {
				merged[result.hostname] = result.url;
			}
		}
		set({ faviconByHostname: merged });
	},
}));
