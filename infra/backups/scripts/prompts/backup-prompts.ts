import { LangfuseClient } from "@langfuse/client";
import { writeFile } from "node:fs/promises";

if (!process.env.OUTPUT_FILE) {
	console.error("missing environment variables: OUTPUT_FILE");
	process.exit(1);
}

const OUTPUT_FILE = process.env.OUTPUT_FILE;

const langfuse = new LangfuseClient();

type Prompt = Awaited<ReturnType<typeof langfuse.api.prompts.get>>;

async function main() {
	const prompts: Record<string, Prompt[]> = {};

	let page = 1;
	const limit = 5;

	while (true) {
		const promptMetaList = await langfuse.api.prompts.list({ page, limit });

		for (const promptMetaItem of promptMetaList.data) {
			const { name } = promptMetaItem;

			for (const version of promptMetaItem.versions) {
				const promptDetails = await langfuse.api.prompts.get(name, { version });
				prompts[name] = [...(prompts[name] ?? []), promptDetails];
			}
		}

		if (page >= promptMetaList.meta.totalPages) {
			break;
		}

		page = page + 1;
	}

	await writeFile(OUTPUT_FILE, JSON.stringify(prompts, null, 2));
}

main();
