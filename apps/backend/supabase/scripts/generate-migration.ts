/* eslint-disable no-console */
/**
 * Generate a migration by diffing the declarative schemas in supabase/schemas
 * against the local database, then format the generated file with prettier.
 *
 * Wraps `supabase db diff --schema public -f <MIGRATION_NAME>`, which writes
 * migrations/<DATETIME>_<MIGRATION_NAME>.sql. Only the new file is formatted,
 * so existing migrations stay untouched.
 *
 * Prerequisite: the local Supabase stack is running (`supabase start`).
 *
 * Run: npm run db:generate-migration <MIGRATION_NAME>
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";

function usage(error: string): never {
	console.error(`Error: ${error}`);
	console.error("Usage: npm run db:generate-migration <MIGRATION_NAME>");
	console.error(
		"Example: npm run db:generate-migration add_user_settings_table",
	);
	process.exit(1);
}

// npm passes through both `npm run x foo` and `npm run x -- foo`.
const args = process.argv.slice(2).filter((arg) => arg !== "--");

if (args.length > 1) {
	usage(`expected a single migration name, got ${args.length} arguments.`);
}

const migrationName = args[0] ?? "";

if (migrationName === "") {
	usage("migration name is missing.");
}

if (!/^[a-z0-9_]+$/i.test(migrationName)) {
	usage(
		`invalid migration name "${migrationName}" — use letters, digits and underscores only.`,
	);
}

if (!existsSync(MIGRATIONS_DIR)) {
	usage(
		`"${MIGRATIONS_DIR}" not found — run this from the apps/backend workspace.`,
	);
}

const before = new Set(readdirSync(MIGRATIONS_DIR));

const diff = spawnSync(
	"supabase",
	["db", "diff", "--schema", "public", "-f", migrationName],
	{ stdio: "inherit" },
);

if (diff.error || diff.status !== 0) {
	console.error(
		`Error: supabase db diff failed ${diff.error ? `: ${diff.error.message}` : ""}.`,
	);
	process.exit(diff.status ?? 1);
}

const created = readdirSync(MIGRATIONS_DIR).filter(
	(file) => !before.has(file) && file.endsWith(`_${migrationName}.sql`),
);

if (created.length === 0) {
	console.log("No schema changes detected — no migration written.");
	process.exit(0);
}

const format = spawnSync(
	"prettier",
	["--write", ...created.map((file) => join(MIGRATIONS_DIR, file))],
	{ stdio: "inherit" },
);

if (format.error || format.status !== 0) {
	console.error(
		`Error: prettier failed${format.error ? `: ${format.error.message}` : ""} — the migration was written but is unformatted.`,
	);
	process.exit(format.status ?? 1);
}
