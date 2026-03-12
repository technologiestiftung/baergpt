/* eslint-disable no-console */
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const {
	S3_ENDPOINT,
	S3_ACCESS_KEY_ID,
	S3_SECRET_ACCESS_KEY,
	S3_BUCKET_NAME,
	SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (
	!S3_ENDPOINT ||
	!S3_ACCESS_KEY_ID ||
	!S3_SECRET_ACCESS_KEY ||
	!S3_BUCKET_NAME ||
	!SUPABASE_URL ||
	!SUPABASE_SERVICE_ROLE_KEY
) {
	console.error("Missing required environment variables.");
	process.exit(1);
}

const s3Client = new S3Client({
	endpoint: S3_ENDPOINT,
	region: "custom",
	credentials: {
		accessKeyId: S3_ACCESS_KEY_ID,
		secretAccessKey: S3_SECRET_ACCESS_KEY,
	},
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
	const isDryRun = process.argv.includes("--dry-run");

	if (isDryRun) {
		console.log("Running in dry-run mode. No objects will be deleted.");
	}

	console.log("Fetching S3 objects...");
	const s3Keys = await listAllS3Objects();
	console.log(`Found ${s3Keys.length} objects in S3.`);

	console.log("Fetching source URLs from database...");
	const sourceUrls = await getDocumentSourceUrls();
	console.log(`Found ${sourceUrls.size} documents in database.`);

	/**
	 * Convert S3 key to source_url format for comparison:
	 * S3 key format: 			stub/<supabase-bucket-name>/<user-id>/<file-name>/<uuid>
	 * source_url format: 	<user-id>/<file-name>
	 * @param key
	 */
	const toSourceUrl = (key: string) => {
		const parts = key.split("/");
		return parts.slice(2, -1).join("/");
	};

	const orphanKeys = s3Keys.filter((key) => !sourceUrls.has(toSourceUrl(key)));

	if (orphanKeys.length === 0) {
		console.log("No orphans found.");
		return;
	}

	console.log(`Found ${orphanKeys.length} orphan(s) in S3.`);

	if (isDryRun) {
		console.log("Dry-run mode: orphans found, but skipping deletion.");
		return;
	}

	// TODO re-add this once we can run it safely.
	// console.log(`Starting deletion of ${orphanKeys.length} orphan(s) from S3...`);
	// await deleteS3Objects(orphanKeys);
	// console.log(`Deleted ${orphanKeys.length} orphan(s) from S3.`);
}

async function listAllS3Objects(): Promise<string[]> {
	const keys: string[] = [];

	let response = await s3Client.send(
		new ListObjectsV2Command({
			Bucket: S3_BUCKET_NAME,
		}),
	);

	while (true) {
		for (const obj of response.Contents ?? []) {
			if (obj.Key) {
				keys.push(obj.Key);
			}
		}

		if (!response.NextContinuationToken) {
			break;
		}

		response = await s3Client.send(
			new ListObjectsV2Command({
				Bucket: S3_BUCKET_NAME,
				ContinuationToken: response.NextContinuationToken,
			}),
		);
	}

	return keys;
}

async function getDocumentSourceUrls(): Promise<Set<string>> {
	const sourceUrls: string[] = [];
	const pageSize = 1000;

	let from = 0;

	while (true) {
		const to = from + pageSize - 1;
		const { data, error } = await supabase
			.from("documents")
			.select("source_url")
			.range(from, to);

		if (error) {
			throw new Error(`Failed to fetch documents: ${error.message}`);
		}

		if (!data || data.length === 0) {
			break;
		}

		sourceUrls.push(...data.map((row) => row.source_url));

		if (data.length < pageSize) {
			break;
		}

		from += pageSize;
	}

	return new Set(sourceUrls);
}

// TODO re-add this once we can run it safely.
// async function deleteS3Objects(keys: string[]): Promise<void> {
// 	const maxS3BatchSize = 1000;
//
// 	console.log(`Starting batch deletion of orphaned S3 objects in batches`);
//
// 	for (let i = 0; i < keys.length; i += maxS3BatchSize) {
// 		const batch = keys.slice(i, i + maxS3BatchSize);
//
// 		const objectsToDelete = batch.map((key) => ({
// 			Key: key,
// 		}));
//
// 		const deleteCommand = new DeleteObjectsCommand({
// 			Bucket: S3_BUCKET_NAME,
// 			Delete: { Objects: objectsToDelete },
// 		});
// 		await s3Client.send(deleteCommand);
//
// 		console.log(`Deleted ${batch.length} objects ✅ ${Math.min(i + maxS3BatchSize, keys.length)} / ${keys.length}`);
// 	}
// }

run().catch((error) => {
	console.error("Unexpected error:", error);
	process.exit(1);
});
