import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "./config";

const supabase = createClient<Database>(
	config.supabaseUrl,
	config.supabaseServiceRoleKey,
	{
		auth: { persistSession: false },
	},
);

export { supabase };
