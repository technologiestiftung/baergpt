import { serviceRoleDbClient } from "../src/supabase";
import { countMistralTokens } from "../src/services/token-utils";
import { config } from "../src/config";

const MAX_TOKENS = config.mistralEmbedMaxContextTokens;
const FETCH_BATCH_SIZE = 500;

async function findOversizedChunks() {
	// eslint-disable-next-line no-console
	console.log(
		`Scanning all document_chunks for content exceeding ${MAX_TOKENS} Mistral tokens...\n`,
	);

	const oversized: {
		id: number;
		document_id: number;
		tokens: number;
		chars: number;
	}[] = [];
	let offset = 0;
	let totalScanned = 0;

	while (true) {
		const { data: chunks, error } = await serviceRoleDbClient
			.from("document_chunks")
			.select("id, document_id, content")
			.range(offset, offset + FETCH_BATCH_SIZE - 1)
			.order("id", { ascending: true });

		if (error) {
			console.error("Error fetching chunks:", error);
			process.exit(1);
		}

		if (!chunks || chunks.length === 0) break;

		for (const chunk of chunks) {
			if (chunk.document_id == null) continue;
			const tokens = countMistralTokens(chunk.content);
			if (tokens > MAX_TOKENS) {
				oversized.push({
					id: chunk.id,
					document_id: chunk.document_id,
					tokens,
					chars: chunk.content.length,
				});
			}
		}

		totalScanned += chunks.length;
		process.stdout.write(
			`\rScanned ${totalScanned} chunks, found ${oversized.length} oversized so far...`,
		);

		if (chunks.length < FETCH_BATCH_SIZE) break;
		offset += FETCH_BATCH_SIZE;
	}

	console.log(`\n\nDone. Scanned ${totalScanned} chunks total.\n`);

	if (oversized.length === 0) {
		console.log("No oversized chunks found.");
		return;
	}

	console.log(
		`Found ${oversized.length} chunks exceeding ${MAX_TOKENS} tokens:\n`,
	);
	console.log("id\t\tdocument_id\ttokens\t\tchars");
	console.log("─".repeat(60));
	for (const c of oversized.sort((a, b) => b.tokens - a.tokens)) {
		console.log(`${c.id}\t\t${c.document_id}\t\t${c.tokens}\t\t${c.chars}`);
	}

	const uniqueDocs = [...new Set(oversized.map((c) => c.document_id))];
	console.log(
		`\nAffected document IDs (${uniqueDocs.length} unique): ${uniqueDocs.join(", ")}`,
	);
}

findOversizedChunks().catch((err) => {
	console.error("Unhandled error:", err);
	process.exit(1);
});
