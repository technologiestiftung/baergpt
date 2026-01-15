import { supabase } from "../../../supabase-client.ts";

export async function registerUser({
	email,
	password,
	firstName,
	lastName,
}: {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
}) {
	return supabase.auth.signUp({
		email,
		password,
		options: {
			data: { first_name: firstName, last_name: lastName },
		},
	});
}
