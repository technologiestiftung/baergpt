import { create } from "zustand";
import { getSplashScreenContent } from "../api/splash-screen/get-splash-screen-content.ts";
import { captureError } from "../monitoring/capture-error.ts";
import { config } from "../config.ts";

type SplashScreenStore = {
	isOpen: boolean;
	content: string;
};

export const STORAGE_KEY = "last-seen-version";
const CURRENT_VERSION = import.meta.env.VITE_BUILD_TIMESTAMP;

export const useSplashScreenStore = create<SplashScreenStore>()(() => {
	init().catch(captureError);

	return {
		isOpen: false,
		content: "",
	};
});

export async function init() {
	if (!config.featureFlagSplashScreenAllowed) {
		return;
	}

	if (!isNewVersionAvailable()) {
		return;
	}

	const content = await getSplashScreenContent();
	useSplashScreenStore.setState({ content, isOpen: true });
}

export function isNewVersionAvailable(): boolean {
	const lastSeenVersion = localStorage.getItem(STORAGE_KEY);

	if (!lastSeenVersion) {
		return true;
	}

	return lastSeenVersion !== CURRENT_VERSION;
}

export function markVersionAsSeen() {
	localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
}
