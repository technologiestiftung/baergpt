/* eslint-disable no-console */
import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

const SCHEMAS_DIR = join(__dirname, "..", "schemas");
const SOURCE_FILE = join(SCHEMAS_DIR, "schema.sql");
const CONFIG_FILE = join(__dirname, "..", "config.toml");
const TABLES_DIR = join(SCHEMAS_DIR, "20_tables");
const EXTENSIONS_FILE = "00_extensions.sql";
const ORPHANED_FILE = "90_orphaned.sql";

const isDryRun = process.argv.includes("--dry-run");

type Statement = { text: string; startLine: number };

// Splits a SQL dump into top-level statements, tracking single-quoted strings,
// double-quoted identifiers, dollar-quoted function bodies and line comments so
// semicolons inside them don't get treated as statement terminators.
function splitStatements(sql: string): Statement[] {
	const statements: Statement[] = [];
	const n = sql.length;
	let i = 0;
	let line = 1;
	let statementStart = 0;
	let statementStartLine = 1;
	let inSingleQuote = false;
	let inDoubleQuote = false;
	let dollarTag: string | null = null;

	while (i < n) {
		const ch = sql[i];
		if (ch === "\n") {
			line++;
		}

		if (dollarTag) {
			if (sql.startsWith(dollarTag, i)) {
				i += dollarTag.length;
				dollarTag = null;
			} else {
				i++;
			}
			continue;
		}

		if (inSingleQuote) {
			if (ch === "'") {
				if (sql[i + 1] === "'") {
					i += 2;
					continue;
				}
				inSingleQuote = false;
			}
			i++;
			continue;
		}

		if (inDoubleQuote) {
			if (ch === '"') {
				if (sql[i + 1] === '"') {
					i += 2;
					continue;
				}
				inDoubleQuote = false;
			}
			i++;
			continue;
		}

		if (ch === "-" && sql[i + 1] === "-") {
			const nl = sql.indexOf("\n", i);
			i = nl === -1 ? n : nl;
			continue;
		}

		if (ch === "'") {
			inSingleQuote = true;
			i++;
			continue;
		}
		if (ch === '"') {
			inDoubleQuote = true;
			i++;
			continue;
		}
		if (ch === "$") {
			const match = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i));
			if (match) {
				dollarTag = match[0];
				i += match[0].length;
				continue;
			}
		}

		if (ch === ";") {
			const text = sql.slice(statementStart, i + 1).trim();
			if (text.length > 0) {
				statements.push({ text, startLine: statementStartLine });
			}
			i++;
			statementStart = i;
			statementStartLine = line;
			continue;
		}

		i++;
	}

	const rest = sql.slice(statementStart).trim();
	if (rest.length > 0) {
		statements.push({ text: rest, startLine: statementStartLine });
	}

	return statements;
}

const QUALIFIED_RE = /"public"\s*\.\s*"((?:[^"]|"")+)"/;

function firstPublicQualifiedName(text: string): string | null {
	return QUALIFIED_RE.exec(text)?.[1] ?? null;
}

const statements = splitStatements(readFileSync(SOURCE_FILE, "utf8"));

// Pass 1: learn every table/sequence name and how sequences map to owning tables,
// so pass 2 can route ALTER/GRANT/COMMENT statements without guessing from names.
const tableNames = new Set<string>();
const sequenceNames = new Set<string>();
const sequenceToTable = new Map<string, string>();

for (const { text } of statements) {
	const createTable =
		/^CREATE TABLE(?: IF NOT EXISTS)?\s+"public"\s*\.\s*"((?:[^"]|"")+)"/i.exec(
			text,
		);
	if (createTable) {
		tableNames.add(createTable[1]);
	}

	// GENERATED ... AS IDENTITY columns declare their backing sequence via
	// `SEQUENCE NAME "public"."x_id_seq"`, either inline in CREATE TABLE or (as in this
	// dump) in a separate `ALTER TABLE ... ALTER COLUMN ... ADD GENERATED ...` statement.
	// Either way the owning table is whichever "public"."X" appears first in the statement.
	const identitySeqRe = /SEQUENCE NAME\s+"public"\s*\.\s*"((?:[^"]|"")+)"/gi;
	if (identitySeqRe.test(text)) {
		const owningTable = firstPublicQualifiedName(text);
		if (owningTable) {
			identitySeqRe.lastIndex = 0;
			let identityMatch: RegExpExecArray | null;
			while ((identityMatch = identitySeqRe.exec(text))) {
				sequenceNames.add(identityMatch[1]);
				sequenceToTable.set(identityMatch[1], owningTable);
			}
		}
	}

	const createSeq =
		/^CREATE SEQUENCE(?: IF NOT EXISTS)?\s+"public"\s*\.\s*"((?:[^"]|"")+)"/i.exec(
			text,
		);
	if (createSeq) {
		sequenceNames.add(createSeq[1]);
	}

	const ownedBy =
		/^ALTER SEQUENCE\s+"public"\s*\.\s*"((?:[^"]|"")+)"\s+OWNED BY\s+"public"\s*\.\s*"((?:[^"]|"")+)"/i.exec(
			text,
		);
	if (ownedBy) {
		sequenceToTable.set(ownedBy[1], ownedBy[2]);
	}
}

type Bucket =
	| { kind: "settings" }
	| { kind: "schema" }
	| { kind: "functions" }
	| { kind: "foreign_keys" }
	| { kind: "policies" }
	| { kind: "table"; table: string }
	| { kind: "orphaned" }
	| { kind: "unclassified" };

const SETTINGS_RE = [/^SET\b/i, /^SELECT\s+pg_catalog\.set_config/i];
const SCHEMA_RE = [
	/^CREATE SCHEMA\b/i,
	/^ALTER SCHEMA\b/i,
	/^COMMENT ON SCHEMA\b/i,
	/^ALTER DEFAULT PRIVILEGES\b/i,
	/\bON SCHEMA\b/i,
];
const FUNCTIONS_RE = [
	/^CREATE (OR REPLACE )?FUNCTION\b/i,
	/^ALTER FUNCTION\b/i,
	/^COMMENT ON FUNCTION\b/i,
	/\bON FUNCTION\b/i,
];
const FOREIGN_KEY_RE = /ADD CONSTRAINT\s+"[^"]+"\s+FOREIGN KEY\b/i;
// RLS's on/off switch travels with its policies, not with the table definition:
// neither means anything without the other, so they're reviewed as one unit.
const POLICIES_RE = [
	/^CREATE POLICY\b/i,
	/\bENABLE ROW LEVEL SECURITY\b/i,
	/\bDISABLE ROW LEVEL SECURITY\b/i,
];
const matchesAny = (patterns: RegExp[], text: string) =>
	patterns.some((pattern) => pattern.test(text));

function classify(text: string): Bucket {
	if (matchesAny(SETTINGS_RE, text)) {
		return { kind: "settings" };
	}
	if (/^CREATE EXTENSION\b/i.test(text)) {
		// already hand-maintained in 00_extensions.sql
		return { kind: "unclassified" };
	}
	if (matchesAny(SCHEMA_RE, text)) {
		return { kind: "schema" };
	}
	if (matchesAny(FUNCTIONS_RE, text)) {
		return { kind: "functions" };
	}
	if (FOREIGN_KEY_RE.test(text)) {
		return { kind: "foreign_keys" };
	}
	if (matchesAny(POLICIES_RE, text)) {
		return { kind: "policies" };
	}

	const name = firstPublicQualifiedName(text);
	if (name) {
		if (tableNames.has(name)) {
			return { kind: "table", table: name };
		}
		if (sequenceNames.has(name)) {
			const owner = sequenceToTable.get(name);
			return owner ? { kind: "table", table: owner } : { kind: "orphaned" };
		}
	}

	return { kind: "unclassified" };
}

const settings: Statement[] = [];
const schema: Statement[] = [];
const functions: Statement[] = [];
const foreignKeys: Statement[] = [];
const policies: Statement[] = [];
const orphaned: Statement[] = [];
const unclassified: Statement[] = [];
const byTable = new Map<string, Statement[]>();
for (const table of tableNames) {
	byTable.set(table, []);
}

for (const statement of statements) {
	const bucket = classify(statement.text);
	switch (bucket.kind) {
		case "settings":
			settings.push(statement);
			break;
		case "schema":
			schema.push(statement);
			break;
		case "functions":
			functions.push(statement);
			break;
		case "foreign_keys":
			foreignKeys.push(statement);
			break;
		case "policies":
			policies.push(statement);
			break;
		case "table":
			byTable.get(bucket.table)!.push(statement);
			break;
		case "orphaned":
			orphaned.push(statement);
			break;
		case "unclassified":
			unclassified.push(statement);
			break;
	}
}

if (unclassified.length > 0) {
	console.error(
		`\nFailed: ${unclassified.length} statement(s) could not be classified. Nothing was written.\n`,
	);
	for (const { text, startLine } of unclassified) {
		console.error(`--- schema.sql:${startLine} ---`);
		console.error(text.slice(0, 300));
		console.error("");
	}
	console.error("Add a routing rule for these in classify() and re-run.");
	process.exit(1);
}

const render = (bucketStatements: Statement[]) =>
	`${bucketStatements.map((s) => s.text).join("\n\n")}\n`;

const filesToWrite = new Map<string, string>();
filesToWrite.set("00_settings.sql", render(settings));
filesToWrite.set("01_schema.sql", render(schema));
filesToWrite.set("02_functions.sql", render(functions));
for (const [table, tableStatements] of byTable) {
	filesToWrite.set(`20_tables/${table}.sql`, render(tableStatements));
}
filesToWrite.set("30_foreign_keys.sql", render(foreignKeys));
filesToWrite.set("40_policies.sql", render(policies));
if (orphaned.length > 0) {
	const banner =
		"-- Objects with no resolvable owning table (e.g. a sequence left behind by a dropped table).\n" +
		"-- Kept so nothing from the original dump is silently lost -- review and decide whether to\n" +
		"-- drop them via a migration instead of carrying them forward declaratively.\n\n";
	filesToWrite.set(ORPHANED_FILE, banner + render(orphaned));
}

console.log("Classification summary:");
console.log(`  settings.......... ${settings.length}`);
console.log(`  schema............ ${schema.length}`);
console.log(`  functions......... ${functions.length}`);
for (const [table, tableStatements] of byTable) {
	console.log(
		`${`  table ${table}`.padEnd(35, ".")} ${tableStatements.length}`,
	);
}
console.log(`  foreign_keys...... ${foreignKeys.length}`);
console.log(`  policies.......... ${policies.length}`);
if (orphaned.length > 0) {
	console.log(`  orphaned (needs review)... ${orphaned.length}`);
}

if (isDryRun) {
	console.log("\nDry run: no files were written.");
	process.exit(0);
}

// Clear out anything we previously generated so a renamed/dropped table
// doesn't leave a stale file behind. Never touches 00_extensions.sql or
// schema.sql itself (removed explicitly, below, only after a clean write).
if (existsSync(TABLES_DIR)) {
	rmSync(TABLES_DIR, { recursive: true });
}
mkdirSync(TABLES_DIR, { recursive: true });
for (const entry of readdirSync(SCHEMAS_DIR)) {
	if (
		entry === EXTENSIONS_FILE ||
		entry === "schema.sql" ||
		entry === "20_tables"
	) {
		continue;
	}
	if (/\.sql$/.test(entry)) {
		unlinkSync(join(SCHEMAS_DIR, entry));
	}
}

for (const [relativePath, content] of filesToWrite) {
	writeFileSync(join(SCHEMAS_DIR, relativePath), content);
}

unlinkSync(SOURCE_FILE);

const schemaPaths = [
	`./schemas/${EXTENSIONS_FILE}`,
	...[...filesToWrite.keys()].filter((f) => f !== ORPHANED_FILE),
	...(orphaned.length > 0 ? [ORPHANED_FILE] : []),
].map((f) => (f.startsWith("./") ? f : `./schemas/${f}`));

const configToml = readFileSync(CONFIG_FILE, "utf8");
const schemaPathsBlock = `schema_paths = [\n${schemaPaths.map((p) => `    "${p}",`).join("\n")}\n]`;
const updatedConfig = configToml.replace(
	/schema_paths\s*=\s*\[[^\]]*\]/,
	schemaPathsBlock,
);
if (updatedConfig === configToml) {
	console.error(
		"Could not find a schema_paths = [...] block in config.toml -- update it manually.",
	);
	process.exit(1);
}
writeFileSync(CONFIG_FILE, updatedConfig);

execSync(`npx prettier --write "${SCHEMAS_DIR}"`, {
	stdio: "inherit",
});

console.log(
	`\nWrote ${filesToWrite.size} file(s) under ${SCHEMAS_DIR}, removed schema.sql, updated config.toml.`,
);
if (orphaned.length > 0) {
	console.log(
		`Review ${ORPHANED_FILE} -- ${orphaned.length} statement(s) had no owning table.`,
	);
}
