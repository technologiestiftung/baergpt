import { config } from "../../config.ts";

export async function getSplashScreenContent(): Promise<string> {
	const response = await fetch(config.splashContentUrl);

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	return response.text();
}
