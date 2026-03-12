/* eslint-disable no-console */
import { Mistral } from "@mistralai/mistralai";
import { config } from "dotenv";
import { ocrTempFileName } from "../../src/constants";

config();

const apiKey = process.env.MISTRAL_API_KEY;

if (!apiKey) {
	console.error("Missing MISTRAL_API_KEY environment variable.");
	process.exit(1);
}

const mistral = new Mistral({ apiKey });

async function run() {
	const isDryRun = process.argv.includes("--dry-run");

	if (isDryRun) {
		console.log("Running in dry-run mode. No objects will be deleted.");
	}

	console.log("Fetching Mistral Files...");
	let result = await mistral.files.list({
		search: ocrTempFileName,
	});
	const { total: initialTotal } = result;

	if (initialTotal === 0) {
		console.log("No orphans found.");
		return;
	}

	console.log(`Found ${initialTotal} orphan(s) in Mistral Files.`);

	if (isDryRun) {
		console.log("Dry-run mode: orphans found, but skipping deletion.");
		return;
	}
	console.log(
		`Starting deletion of ${initialTotal} orphan(s) from Mistral Files...`,
	);

	let count = 0;

	while (result.total > 0) {
		for (const file of result.data) {
			count = count + 1;

			await mistral.files.delete({ fileId: file.id });

			console.log(`Deleted file ${file.id} ✅ ${count} / ${initialTotal}`);
		}
		result = await mistral.files.list({
			search: ocrTempFileName,
		});
	}
	console.log(`Deleted ${count} orphan(s) from Mistral.`);
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});
