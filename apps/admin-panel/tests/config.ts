type Config = {
	supabaseUrl: string;
	supabaseServiceKey: string;
	supabaseAnonKey: string;
};

export function verifyConfig() {
	if (!process.env.VITE_SUPABASE_URL) {
		throw new Error("VITE_SUPABASE_URL must be defined");
	}
	if (!process.env.VITE_TEST_SUPABASE_SERVICE_ROLE_KEY) {
		throw new Error("VITE_TEST_SUPABASE_SERVICE_ROLE_KEY must be defined");
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
	supabaseServiceKey: process.env.VITE_TEST_SUPABASE_SERVICE_ROLE_KEY || "",
	supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
};
