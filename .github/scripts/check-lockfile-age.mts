/**
 * Fails if package-lock.json adds a registry package version younger than the
 * `min-release-age` (days) in .npmrc. npm only applies that setting when it
 * resolves versions, not during `npm ci`, so a lockfile changed outside npm
 * (or by an npm that ignores .npmrc) would otherwise install it unchecked.
 *
 * Only versions that are not in the base lockfile are checked.
 *
 * Usage: node .github/scripts/check-lockfile-age.mts <base-package-lock.json>
 */
import { readFileSync } from "node:fs";

const REGISTRY = "https://registry.npmjs.org/";
const CONCURRENCY = 8;

type Lockfile = {
	packages: Record<
		string,
		{ name?: string; version?: string; resolved?: string; link?: boolean }
	>;
};

function readMinReleaseAgeDays(): number {
	const match = readFileSync(".npmrc", "utf8").match(
		/^\s*min-release-age\s*=\s*(\d+)\s*$/m,
	);
	if (!match) {
		throw new Error("min-release-age is not set in .npmrc");
	}
	return Number(match[1]);
}

function registryVersions(lockfile: Lockfile): Set<string> {
	const versions = new Set<string>();
	for (const [path, entry] of Object.entries(lockfile.packages)) {
		if (!entry.resolved?.startsWith(REGISTRY) || !entry.version) {
			continue;
		}
		// Aliased packages carry their real name in `name`; otherwise it's the path's tail.
		const name =
			entry.name ?? path.slice(path.lastIndexOf("node_modules/") + 13);
		versions.add(`${name}@${entry.version}`);
	}
	return versions;
}

function splitNameAndVersion(nameAndVersion: string) {
	const at = nameAndVersion.lastIndexOf("@");
	return {
		name: nameAndVersion.slice(0, at),
		version: nameAndVersion.slice(at + 1),
	};
}

async function fetchPublishTimes(
	name: string,
): Promise<Record<string, string>> {
	const response = await fetch(`${REGISTRY}${name.replace("/", "%2f")}`);
	if (!response.ok) {
		throw new Error(`Fetching ${name} failed: ${response.status}`);
	}
	const { time } = (await response.json()) as { time: Record<string, string> };
	return time;
}

async function main() {
	const [basePath] = process.argv.slice(2);
	if (!basePath) {
		throw new Error("Usage: check-lockfile-age.mts <base-package-lock.json>");
	}

	const minAgeDays = readMinReleaseAgeDays();
	const base = registryVersions(JSON.parse(readFileSync(basePath, "utf8")));
	const head = registryVersions(
		JSON.parse(readFileSync("package-lock.json", "utf8")),
	);
	const added = [...head].filter((version) => !base.has(version));

	console.log(
		`${added.length} package version(s) added to package-lock.json, checking they are at least ${minAgeDays} day(s) old.`,
	);

	const versionsByName = new Map<string, string[]>();
	for (const nameAndVersion of added) {
		const { name, version } = splitNameAndVersion(nameAndVersion);
		versionsByName.set(name, [...(versionsByName.get(name) ?? []), version]);
	}

	const cutoff = Date.now() - minAgeDays * 24 * 60 * 60 * 1000;
	const tooYoung: string[] = [];
	const names = [...versionsByName.keys()];

	for (let i = 0; i < names.length; i += CONCURRENCY) {
		await Promise.all(
			names.slice(i, i + CONCURRENCY).map(async (name) => {
				const times = await fetchPublishTimes(name);
				for (const version of versionsByName.get(name) ?? []) {
					const publishedAt = times[version];
					if (!publishedAt) {
						tooYoung.push(`${name}@${version} (no publish time in registry)`);
					} else if (Date.parse(publishedAt) > cutoff) {
						tooYoung.push(`${name}@${version} (published ${publishedAt})`);
					}
				}
			}),
		);
	}

	if (tooYoung.length > 0) {
		console.error(
			`These versions are younger than min-release-age=${minAgeDays} in .npmrc:\n${tooYoung
				.sort()
				.map((entry) => `  - ${entry}`)
				.join("\n")}`,
		);
		process.exit(1);
	}

	console.log("All added versions are old enough.");
}

await main();
