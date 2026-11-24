import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../backend",
);

/**
 * Reads the service role key from the running local Supabase, so it never
 * lives in an .env file. Playwright workers inherit it via process.env.
 */
function loadServiceRoleKey(): string {
	if (process.env.TEST_SUPABASE_SERVICE_ROLE_KEY) {
		return process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
	}
	const output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
		cwd: backendDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	const match = output.match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m);
	if (!match) {
		throw new Error(
			"SERVICE_ROLE_KEY not found in `supabase status`. Is local Supabase running?",
		);
	}
	process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = match[1];
	return match[1];
}

type Config = {
	supabaseUrl: string;
	supabaseServiceKey: string;
	supabaseAnonKey: string;
};

export function verifyConfig() {
	if (!process.env.VITE_SUPABASE_URL) {
		throw new Error("VITE_SUPABASE_URL must be defined");
	}
	if (!process.env.VITE_SUPABASE_ANON_KEY) {
		throw new Error("VITE_SUPABASE_ANON_KEY must be defined");
	}

	assertLocalTarget();
}

function assertLocalTarget() {
	const supabaseUrl = process.env.VITE_SUPABASE_URL || "";

	let host: string;
	try {
		host = new URL(supabaseUrl).hostname;
	} catch {
		throw new Error(`VITE_SUPABASE_URL is not a valid URL: "${supabaseUrl}"`);
	}

	const localHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
	if (!localHosts.includes(host)) {
		throw new Error(
			`Refusing to run e2e tests: VITE_SUPABASE_URL points to a non-local target ("${supabaseUrl}"). ` +
				`These tests seed and mutate data and are only meant to run against a local Supabase instance. ` +
				`Check your environment variables — they may be pointing at staging/production.`,
		);
	}
}

export const config: Config = {
	supabaseUrl: process.env.VITE_SUPABASE_URL || "",
	supabaseServiceKey: loadServiceRoleKey(),
	supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
};
