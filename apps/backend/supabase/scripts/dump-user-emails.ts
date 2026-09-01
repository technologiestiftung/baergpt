/* eslint-disable no-console */
/**
 * Fetch all users (first name, last name, email) from auth.users by paginating
 * through Supabase's Admin API.
 *
 * Requires the SERVICE ROLE key (not the anon key) since auth.users is only
 * accessible via the admin API, not the public REST API / regular client.
 *
 * Prerequisite: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in .env file
 *
 * Run: npm run dev db:dump-user-emails
 *
 * Writes vorname,nachname,email per line to user-emails.csv.
 *
 * Prints the target Supabase URL and asks for a y/n confirmation before dumping
 * (guard against pointing at the wrong project).
 */

import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	throw new Error(
		"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
	);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

const PAGE_SIZE = 100;

type UserRecord = {
	firstName: string;
	lastName: string;
	email: string;
};

async function fetchAllUsers(): Promise<UserRecord[]> {
	const records: UserRecord[] = [];
	let page = 1;

	while (true) {
		const { data, error } = await supabase.auth.admin.listUsers({
			page,
			perPage: PAGE_SIZE,
		});

		if (error) {
			throw new Error(`Error fetching page ${page}: ${error.message}`);
		}

		const users = data.users;
		if (users.length === 0) {
			break; // no more results
		}

		for (const user of users) {
			if (user.email) {
				const metadata = user.user_metadata ?? {};
				records.push({
					firstName: String(metadata.first_name ?? ""),
					lastName: String(metadata.last_name ?? ""),
					email: user.email,
				});
			}
		}

		console.log(
			`Fetched page ${page} (${users.length} users, ${records.length} total so far)`,
		);

		// Stop once a short page is returned — means we've hit the last page
		if (users.length < PAGE_SIZE) {
			break;
		}

		page++;
	}

	return records;
}

/** Escape a value for CSV: quote it when it contains a comma, quote, or newline. */
function toCsvField(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function toCsv(records: UserRecord[]): string {
	const rows = [
		"vorname,nachname,email",
		...records.map((record) =>
			[record.firstName, record.lastName, record.email]
				.map(toCsvField)
				.join(","),
		),
	];
	return `${rows.join("\n")}\n`;
}

/**
 * Show which Supabase project this run targets and require a y/n confirmation
 * before dumping personal data — a guard against accidentally pointing at the
 * wrong project.
 */
async function confirmTarget(): Promise<void> {
	console.log("\n⚠️  About to export ALL user emails from:");
	console.log(`    ${SUPABASE_URL}`);
	console.log(
		"    (this reads real personal data — make sure it's the right target)\n",
	);

	const rl = createInterface({ input: stdin, output: stdout });
	try {
		const answer = await rl.question("Continue? (y/n): ");
		if (!/^y(es)?$/i.test(answer.trim())) {
			throw new Error("Aborted by user.");
		}
	} finally {
		rl.close();
	}
}

async function main() {
	await confirmTarget();

	const allUsers = await fetchAllUsers();

	const outputFile = "user-emails.csv";
	writeFileSync(outputFile, toCsv(allUsers), "utf8");

	console.log(`\nDone. Wrote ${allUsers.length} users to ${outputFile}.`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
