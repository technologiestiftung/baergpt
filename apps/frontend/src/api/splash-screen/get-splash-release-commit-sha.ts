import { config } from "../../config.ts";

type GitHubCommitResponse = {
	sha: string;
};

export async function getSplashReleaseCommitSha(): Promise<string> {
	const response = await fetch(config.splashCommitApiUrl, {
		headers: {
			Accept: "application/vnd.github+json",
		},
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const data = (await response.json()) as GitHubCommitResponse;
	return data.sha;
}
