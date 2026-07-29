#!/usr/bin/env node
// @ts-check

import { format } from "sql-formatter";
import fs from "node:fs";

const shouldWrite = process.argv.includes("--write");
const config = JSON.parse(fs.readFileSync(".sql-formatter.json", "utf8"));
const files = fs.globSync("**/*.sql", { exclude: ["**/node_modules/**"] });

let changedCount = 0;

for (const file of files) {
	const original = fs.readFileSync(file, "utf8");
	let formatted = format(original, config);

	// sql-formatter strips the trailing newline, but our files (and Prettier)
	// keep it. Normalize so the comparison is fair.
	if (!formatted.endsWith("\n")) {
		formatted += "\n";
	}

	if (original !== formatted) {
		if (shouldWrite) {
			fs.writeFileSync(file, formatted, "utf8");
			console.log(`Formatted: ${file}`);
			changedCount++;
		} else {
			console.error(`SQL format check failed: ${file}`);
			changedCount++;
		}
	}
}

if (changedCount > 0) {
	if (shouldWrite) {
		console.log(`\nFormatted ${changedCount} SQL file(s).`);
	} else {
		console.error("\nRun `npm run sql:format:write` to fix.");
		process.exit(1);
	}
} else {
	console.log(`All ${files.length} SQL files are correctly formatted.`);
}
