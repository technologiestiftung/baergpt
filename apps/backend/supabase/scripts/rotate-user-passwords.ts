/* eslint-disable no-console */
import { randomBytes } from "node:crypto";
import { serviceRoleDbClient as supabase } from "../../src/supabase";
import { config } from "../../src/config";

const PAGE_SIZE = 1000;

function generateRandomPassword(): string {
	return randomBytes(48).toString("base64url");
}

async function fetchAllUserIds(): Promise<string[]> {
	const ids: string[] = [];
	let page = 1;

	for (;;) {
		const { data, error } = await supabase.auth.admin.listUsers({
			page,
			perPage: PAGE_SIZE,
		});

		if (error) {
			throw new Error(`Failed to list users (page ${page}): ${error.message}`);
		}

		if (data.users.length === 0) {
			break;
		}

		ids.push(...data.users.map((user) => user.id));

		if (data.users.length < PAGE_SIZE) {
			break;
		}

		page += 1;
	}

	return ids;
}

async function run() {
	const isDryRun = process.argv.includes("--dry-run");
	const isConfirmed = process.argv.includes("--yes");

	console.log(`Target Supabase instance: ${config.supabaseUrl}`);

	if (!isDryRun && !isConfirmed) {
		console.error(
			"Refusing to run: pass --dry-run to preview, or --yes to actually rotate passwords.\n" +
				"This action locks every existing user out of password login until they use " +
				"the password-reset flow to set a new one.",
		);
		process.exit(1);
	}

	console.log("Fetching users...");
	const userIds = await fetchAllUserIds();

	if (userIds.length === 0) {
		console.log("No users found.");
		return;
	}

	if (isDryRun) {
		console.log(
			`Dry-run mode: ${userIds.length} user(s) would have their password rotated. No changes made.`,
		);
		return;
	}

	console.log(`Rotating passwords for ${userIds.length} user(s)...`);

	let successCount = 0;
	const failedIds: string[] = [];

	for (const id of userIds) {
		const { error } = await supabase.auth.admin.updateUserById(id, {
			password: generateRandomPassword(),
		});

		if (error) {
			failedIds.push(id);
			console.error(
				`Failed to rotate password for user ${id}: ${error.message}`,
			);
			continue;
		}

		successCount += 1;
		console.log(
			`Rotated ${successCount + failedIds.length} / ${userIds.length}`,
		);
	}

	console.log(
		`Done. Rotated ${successCount} of ${userIds.length} user(s).${
			failedIds.length > 0
				? ` ${failedIds.length} failed: ${failedIds.join(", ")}`
				: ""
		}`,
	);

	if (failedIds.length > 0) {
		process.exit(1);
	}
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});
