import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "./config";

export const adminDatabaseService = createClient<Database>(
	config.supabaseUrl,
	config.supabaseServiceRoleKey,
	{
		auth: { persistSession: false },
	},
);

export function createUserClient(
	accessToken: string,
): SupabaseClient<Database> {
	return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
		auth: { persistSession: false },
		global: {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	});
}

// Only use this throughout integration tests and scripts but not in any services.
export const supabase = adminDatabaseService;
