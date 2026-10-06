import { createClient } from "@supabase/supabase-js";
import { config } from "./config.ts";
import type { Database } from "@repo/db-schema";

export const supabaseAdminClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseServiceKey,
);
export const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

/**
 * Creates a fresh, unauthenticated anon client. Sign-in flows must use their own
 * instance instead of the shared `supabaseAnonClient` singleton: under parallel
 * workers, concurrent `signInWithPassword` calls on one client clobber each
 * other's session. `persistSession: false` keeps the returned session in-hand
 * without mutating any shared storage.
 */
export function createAnonClient() {
	return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
		auth: { persistSession: false },
	});
}
