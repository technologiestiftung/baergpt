import { create } from "zustand";
import { getSplashReleaseCommitSha } from "../api/splash-screen/get-splash-release-commit-sha.ts";
import { getSplashScreenContent } from "../api/splash-screen/get-splash-screen-content.ts";
import { captureError } from "../monitoring/capture-error.ts";
import { config } from "../config.ts";

type SplashScreenStore = {
	isOpen: boolean;
	content: string;
};

export const STORAGE_KEY = "last-seen-version";

let currentVersionIdentifier: string;

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

	const newVersionIdentifier = await getSplashReleaseCommitSha();

	const lastSeenVersion = localStorage.getItem(STORAGE_KEY);
	if (lastSeenVersion === newVersionIdentifier) {
		return;
	}

	try {
		const content = await getSplashScreenContent();
		currentVersionIdentifier = newVersionIdentifier;
		useSplashScreenStore.setState({ content, isOpen: true });
	} catch (error) {
		captureError(error);
	}
}

export function markVersionAsSeen() {
	if (currentVersionIdentifier) {
		localStorage.setItem(STORAGE_KEY, currentVersionIdentifier);
	}
}
