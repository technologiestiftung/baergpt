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
}

export const config: Config = {
	supabaseUrl: process.env.VITE_SUPABASE_URL || "",
	supabaseServiceKey: process.env.VITE_TEST_SUPABASE_SERVICE_ROLE_KEY || "",
	supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
};
