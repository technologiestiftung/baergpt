import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "./config";

export type UserScopedDbClient = SupabaseClient<Database> & {
	readonly __brand: "user-scoped";
};
export type ServiceRoleDbClient = SupabaseClient<Database> & {
	readonly __brand: "service-role";
};

export const serviceRoleDbClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseServiceRoleKey,
	{
		auth: { persistSession: false },
	},
) as ServiceRoleDbClient;

export function createUserScopedDbClient(
	accessToken: string,
): UserScopedDbClient {
	return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
		auth: { persistSession: false },
		global: {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	}) as UserScopedDbClient;
}
