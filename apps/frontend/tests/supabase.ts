import { createClient } from "@supabase/supabase-js";
import { config } from "./config.ts";
import { Database } from "../src/db_schema.ts";

export const supabaseAdminClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseServiceKey,
);
export const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);
