import { serviceRoleDbClient as supabase } from "../../src/supabase";
import type { User } from "@supabase/supabase-js";
import { config } from "../../src/config";

function assertLocalTarget() {
	let host: string;
	try {
		host = new URL(config.supabaseUrl).hostname;
	} catch {
		throw new Error(`SUPABASE_URL is not a valid URL: "${config.supabaseUrl}"`);
	}

	const localHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
	if (!localHosts.includes(host)) {
		throw new Error(
			`Refusing to seed: SUPABASE_URL points to a non-local target ("${config.supabaseUrl}"). ` +
				`This script is only meant to run against a local Supabase instance. ` +
				`Check your environment variables — they may be pointing at staging/production.`,
		);
	}

	/* eslint-disable-next-line no-console */
	console.log(`Seeding admin for local Supabase at ${config.supabaseUrl}`);
}

export async function seedLocalAdmin() {
	assertLocalTarget();

	const id = crypto.randomUUID();
	const email = "local.admin@ts.berlin";
	const password = "123456789!";

	const { data, error: listUsersError } = await supabase.auth.admin.listUsers();

	if (listUsersError) {
		console.error("Error listing users:", listUsersError);
		return;
	}

	const existingUser = data.users.find((user: User) => user.email === email);
	if (existingUser) {
		await handleDelete(existingUser.id);
	}

	const { error: createUserError } = await supabase.auth.admin.createUser({
		id,
		email,
		password,
		email_confirm: true,
		user_metadata: {
			first_name: "Local",
			last_name: "Admin",
		},
	});

	if (createUserError) {
		console.error("Error creating local admin user:", createUserError);
		return;
	}

	const { error: adminError } = await supabase
		.from("application_admins")
		.insert([{ user_id: id }]);

	if (adminError) {
		console.error(
			"Error inserting local admin into application_admins:",
			adminError,
		);
		return;
	}

	const { error: loginError } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (loginError) {
		console.error("Error logging in local admin:", loginError);
		return;
	}

	/* eslint-disable-next-line no-console */
	console.log("done!");
}

async function handleDelete(id: string) {
	console.warn(`User already exists, will delete it and re-seed it`);

	const { error: deletionError } = await supabase.auth.admin.deleteUser(id);

	if (deletionError) {
		console.error("Error deleting existing local admin user:", deletionError);
		return;
	}
}

seedLocalAdmin().catch(console.error);
