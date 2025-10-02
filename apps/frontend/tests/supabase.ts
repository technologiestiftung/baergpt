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
