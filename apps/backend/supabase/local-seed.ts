import { adminDatabaseService as supabase } from "../src/supabase";

export async function seedLocalAdmin() {
	const id = crypto.randomUUID();
	const email = "admin@local.berlin.de";
	const password = "123456789!";

	const { data, error: listUsersError } = await supabase.auth.admin.listUsers();

	if (listUsersError) {
		console.error("Error listing users:", listUsersError);
		return;
	}

	const existingUser = data.users.find((user) => user.email === email);
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

	const { error: accountActivationError } = await supabase.rpc(
		"log_account_activation",
	);

	if (accountActivationError) {
		console.error(
			"Error logging account activation for local admin:",
			accountActivationError,
		);
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
