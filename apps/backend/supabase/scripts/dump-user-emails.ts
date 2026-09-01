/* eslint-disable no-console */
/**
 * Fetch all emails from auth.users by paginating through Supabase's Admin API.
 *
 * Requires the SERVICE ROLE key (not the anon key) since auth.users is only
 * accessible via the admin API, not the public REST API / regular client.
 *
 * Install deps:
 *   npm install @supabase/supabase-js
 *
 * Run:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
 *   npx tsx fetch-all-emails.ts
 *
 * Writes the emails to user-emails.csv.
 *
 * Prints the target Supabase URL and asks for a y/n confirmation before dumping
 * (guard against pointing at the wrong project). Bypass with --yes / -y or
 * SKIP_CONFIRM=1 for non-interactive runs.
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

async function fetchAllEmails(): Promise<string[]> {
	const emails: string[] = [];
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
				emails.push(user.email);
			}
		}

		console.log(
			`Fetched page ${page} (${users.length} users, ${emails.length} total so far)`,
		);

		// Stop once a short page is returned — means we've hit the last page
		if (users.length < PAGE_SIZE) {
			break;
		}

		page++;
	}

	return emails;
}

/** Escape a value for CSV: quote it when it contains a comma, quote, or newline. */
function toCsvField(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function toCsv(emails: string[]): string {
	const rows = ["email", ...emails.map(toCsvField)];
	return `${rows.join("\n")}\n`;
}

/**
 * Show which Supabase project this run targets and require an explicit
 * confirmation before dumping personal data — a guard against accidentally
 * pointing at production. Bypass with --yes / -y or SKIP_CONFIRM=1 (e.g. CI).
 */
async function confirmTarget(): Promise<void> {
	const autoConfirmed =
		process.argv.includes("--yes") ||
		process.argv.includes("-y") ||
		process.env.SKIP_CONFIRM === "1";

	console.log("\n⚠️  About to export ALL user emails from:");
	console.log(`    ${SUPABASE_URL}`);
	console.log("    (this reads real personal data — make sure it's the right target)\n");

	if (autoConfirmed) {
		console.log("Confirmation skipped (--yes / SKIP_CONFIRM).\n");
		return;
	}

	if (!stdin.isTTY) {
		throw new Error(
			"Refusing to run without confirmation in a non-interactive shell. " +
				"Re-run with --yes (or SKIP_CONFIRM=1) if this target is intentional.",
		);
	}

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

	const allEmails = await fetchAllEmails();

	const outputFile = "user-emails.csv";
	writeFileSync(outputFile, toCsv(allEmails), "utf8");

	console.log(`\nDone. Wrote ${allEmails.length} emails to ${outputFile}.`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
