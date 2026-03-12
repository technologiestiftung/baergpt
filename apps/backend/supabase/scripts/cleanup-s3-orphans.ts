/* eslint-disable no-console */
import {
	DeleteObjectsCommand,
	ListObjectsV2Command,
	S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
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

const isDryRun = process.argv.includes("--dry-run");

const s3Client = new S3Client({
	endpoint: S3_ENDPOINT,
	region: "custom",
	credentials: {
		accessKeyId: S3_ACCESS_KEY_ID,
		secretAccessKey: S3_SECRET_ACCESS_KEY,
	},
	forcePathStyle: true,
});

type FileObject = {
	name: string;
	bucketId: string;
};

const supabase = createClient<Database>(
	SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
	if (isDryRun) {
		console.log("Running in dry-run mode. No objects will be deleted.");
	}

	console.log("Fetching documents table...");
	const sourceUrls = await getDocumentSourceUrlsWithStorageObjects();
	console.log(`Found ${sourceUrls.length} documents in the documents table.`);

	console.log("Fetching storage table...");
	const storageObjects = await getAllStorageObjects();
	console.log(`Found ${storageObjects.length} objects in the storage table.`);

	const isStorageTableOrphan = (object: FileObject) =>
		!sourceUrls.some(({ source_url, bucket_id }) => {
			if (bucket_id !== object.bucketId) {
				return false;
			}

			const isWordFileRegex = /\.(docx?)$/i;

			if (source_url.match(isWordFileRegex)) {
				// .doc and .docx files have a .pdf file generated for preview, so we need to check for both the .doc/.docx and the .pdf version in the source URLs.
				const sourceUrlWithoutExtension = source_url.replace(
					isWordFileRegex,
					"",
				);
				return (
					`${source_url}` === object.name ||
					`${sourceUrlWithoutExtension}.pdf` === object.name
				);
			}

			return source_url === object.name;
		});

	const storageTableOrphans = storageObjects.filter(isStorageTableOrphan);

	console.log(
		`Found ${storageTableOrphans.length} orphan(s) in the storage table.`,
	);

	console.log(
		`Starting deletion of ${storageTableOrphans.length} orphan(s) from storage...`,
	);
	await deleteFilesFromStorage(storageTableOrphans);
	console.log(`Deleted ${storageTableOrphans.length} orphan(s) from storage.`);

	console.log("Fetching S3 objects...");
	const s3Keys = await getAllS3Objects();
	console.log(`Found ${s3Keys.length} objects in S3.`);

	const isS3ObjectOrphan = (key: string) => {
		const bucket = extractBucketIdFromS3Key(key);
		return !sourceUrls.some(({ source_url, bucket_id, version }) => {
			if (bucket_id !== bucket) {
				return false;
			}

			const databaseObjectName = `${source_url}/${version}`;
			const s3ObjectName = toSourceUrlWithVersion(key);

			const isWordFileRegex = /\.(docx?)$/i;

			if (source_url.match(isWordFileRegex)) {
				// .doc and .docx files have a .pdf file generated for preview, so we need to check for both the .doc/.docx and the .pdf version in the source URLs.
				const sourceUrlWithoutExtension = source_url.replace(
					isWordFileRegex,
					"",
				);
				return (
					databaseObjectName === s3ObjectName ||
					`${sourceUrlWithoutExtension}.pdf/${version}` === s3ObjectName
				);
			}

			return databaseObjectName === s3ObjectName;
		});
	};

	const orphanKeys = s3Keys.filter(isS3ObjectOrphan);

	if (orphanKeys.length === 0) {
		console.log("No orphan(s) found.");
		return;
	}

	console.log(`Found ${orphanKeys.length} orphan(s) in S3.`);

	console.log(`Starting deletion of ${orphanKeys.length} orphan(s) from S3...`);
	await deleteS3Objects(orphanKeys);
	console.log(`Deleted ${orphanKeys.length} orphan(s) from S3.`);
}

async function getDocumentSourceUrlsWithStorageObjects() {
	const sourceUrls: {
		source_url: string;
		bucket_id: string;
		version: string;
	}[] = [];
	const limit = 1000;

	let offset = 0;

	while (true) {
		const { data, error } = await supabase.rpc(
			"get_documents_with_storage_objects",
			{
				p_limit: limit,
				p_offset: offset,
			},
		);

		if (error) {
			throw error;
		}

		sourceUrls.push(...data);

		if (data.length < limit) {
			break;
		}

		offset = offset + limit;
	}

	return sourceUrls;
}

async function getAllStorageObjects() {
	const documentsObjects = await getStorageObjectsByBucket("documents");
	const publicDocumentsObjects =
		await getStorageObjectsByBucket("public_documents");

	return [...documentsObjects, ...publicDocumentsObjects];
}

async function getStorageObjectsByBucket(bucketId: string) {
	const objects: FileObject[] = [];

	let count = 0;

	while (true) {
		const { data: listedObjects, error } = await supabase.storage
			.from(bucketId)
			.list("", {
				limit: 1000,
				offset: count,
			});

		if (error) {
			throw error;
		}

		if (listedObjects.length === 0) {
			break;
		}

		count += listedObjects.length;

		const currentObjects = [];

		for (const object of listedObjects) {
			if (!object.id) {
				const objectsInFolder = await getStorageObjectsByBucketAndFolder(
					bucketId,
					object.name,
				);
				currentObjects.push(...objectsInFolder);
			} else {
				currentObjects.push({
					name: object.name,
					bucketId,
				});
			}
		}

		objects.push(...currentObjects);
	}

	return objects;
}

async function getStorageObjectsByBucketAndFolder(
	bucketId: string,
	folder: string,
) {
	const objects: FileObject[] = [];

	while (true) {
		const { data: listedObjects, error } = await supabase.storage
			.from(bucketId)
			.list(folder, {
				limit: 1000,
				offset: objects.length,
			});

		if (error) {
			throw error;
		}

		if (listedObjects.length === 0) {
			break;
		}

		objects.push(
			...listedObjects.map(({ name }) => ({
				name: `${folder}/${name}`,
				bucketId,
			})),
		);
	}

	return objects;
}

async function deleteFilesFromStorage(storageObjectsOrphans: FileObject[]) {
	if (isDryRun) {
		console.log(
			"Dry-run mode: skipping actual deletion of storage table orphan(s), would have deleted the following objects:",
		);
		console.table(storageObjectsOrphans);
		return;
	}

	let count = 1;

	for (const file of storageObjectsOrphans) {
		const { error } = await supabase.storage
			.from(file.bucketId)
			.remove([file.name]);

		if (error) {
			console.error(`Failed to delete ${file.bucketId}/${file.name}:`, error);
		} else {
			console.log(
				`Deleted ${file.bucketId}/${file.name} (${count} / ${storageObjectsOrphans.length})`,
			);
		}

		count += 1;
	}
}

async function getAllS3Objects(): Promise<string[]> {
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

/**
 * S3 key format: stub/<supabase-bucket-name>/<user-id>/<file-name>/<version-uuid>
 */
function extractBucketIdFromS3Key(key: string): string {
	const parts = key.split("/");
	return parts[1];
}

/**
 * Convert S3 key to source_url with version format, for comparison:
 * S3 key format: 			stub/<supabase-bucket-name>/<user-id>/<file-name>/<version-uuid>
 * source_url format: 	<user-id>/<file-name>/<version-uuid>
 */
function toSourceUrlWithVersion(key: string) {
	const parts = key.split("/");
	return parts.slice(2).join("/");
}

async function deleteS3Objects(keys: string[]): Promise<void> {
	if (isDryRun) {
		console.log(
			"Dry-run mode: skipping actual deletion of S3 objects, would have deleted the following keys",
		);
		console.table(keys);
		return;
	}

	const maxS3BatchSize = 1000;

	console.log(`Starting batch deletion of orphaned S3 objects in batches`);

	for (let i = 0; i < keys.length; i += maxS3BatchSize) {
		const batch = keys.slice(i, i + maxS3BatchSize);

		const objectsToDelete = batch.map((key) => ({
			Key: key,
		}));

		const deleteCommand = new DeleteObjectsCommand({
			Bucket: S3_BUCKET_NAME,
			Delete: { Objects: objectsToDelete },
		});
		const response = await s3Client.send(deleteCommand);

		if (response.Errors && response.Errors.length > 0) {
			console.error(
				"Errors occurred while deleting S3 objects:",
				response.Errors,
			);
		} else {
			console.log(
				`Deleted ${batch.length} objects ✅ ${Math.min(i + maxS3BatchSize, keys.length)} / ${keys.length}`,
			);
		}
	}
}

run().catch((error) => {
	console.error("Unexpected error:", error);
	process.exit(1);
});
