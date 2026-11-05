import type { Session } from "@supabase/supabase-js";

// Same rule as public.is_registration_completed in the database
export function hasCompletedRegistration(session: Session) {
	const { first_name, last_name } = session.user.user_metadata ?? {};
	return Boolean(first_name?.trim() && last_name?.trim());
}
