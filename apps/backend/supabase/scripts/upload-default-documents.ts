/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { PrivilegedDbService } from "../../src/services/db-service/privileged-db-service";
import { serviceRoleDbClient } from "../../src/supabase";
import { GenerationService } from "../../src/services/generation-service";
import { EmbeddingService } from "../../src/services/embedding-service";
import type { Document } from "../../src/types/common";
import { config } from "../../src/config";

const sourceType = "default_document";
const bucketName = "public_documents";
const defaultDocumentsDir = resolve(process.cwd(), "./src/default_documents");

function assertTargetAllowed(): void {
	let host: string;
	try {
		host = new URL(config.supabaseUrl).hostname;
	} catch {
		throw new Error(`SUPABASE_URL is not a valid URL: "${config.supabaseUrl}"`);
	}

	const localHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
	if (localHosts.includes(host)) {
		console.log(
			`Uploading default documents to local Supabase at ${config.supabaseUrl}`,
		);
		return;
	}

	if (process.env.ALLOW_REMOTE_UPLOAD !== "true") {
		throw new Error(
			`Refusing to upload: SUPABASE_URL points to a non-local target ("${config.supabaseUrl}"). ` +
				`Your environment variables may be pointing at staging/production. ` +
				`If this is intentional, re-run with ALLOW_REMOTE_UPLOAD=true.`,
		);
	}

	console.warn(
		`⚠️  Uploading default documents to a NON-LOCAL target ("${config.supabaseUrl}") ` +
			`because ALLOW_REMOTE_UPLOAD=true was set.`,
	);
}

// eslint-disable-next-line consistent-return
async function getPdfFiles(): Promise<string[]> {
	try {
		const files = await readdir(defaultDocumentsDir);
		const pdfFiles: string[] = [];

		for (const file of files) {
			const filePath = resolve(defaultDocumentsDir, file);
			const fileStat = await stat(filePath);

			// Only process files (not directories) and PDF files
			if (fileStat.isFile() && file.toLowerCase().endsWith(".pdf")) {
				pdfFiles.push(file);
			}
		}

		return pdfFiles;
	} catch (error) {
		console.error("Error reading default_documents directory:", error);
		process.exit(1);
	}
}

async function checkExistingDocument(
	fileName: string,
	accessGroupId: string,
): Promise<boolean> {
	const sourceUrl = `${accessGroupId}/${fileName}`;
	const { data, error } = await serviceRoleDbClient
		.from("documents")
		.select("id, processing_finished_at")
		.eq("source_url", sourceUrl)
		.eq("source_type", sourceType)
		.maybeSingle();

	if (error) {
		console.error("Error checking for existing document:", error);
		process.exit(1);
	}

	// Return true if document exists and is fully processed
	return !!data?.processing_finished_at;
}

async function getDefaultAccessGroupId(): Promise<string> {
	const { data: accessGroup, error } = await serviceRoleDbClient
		.from("access_groups")
		.select("id")
		.eq("name", "Alle")
		.single();

	if (error || !accessGroup) {
		console.error("Error fetching default access group:", error);
		process.exit(1);
	}

	return accessGroup.id;
}

async function processDocument(
	fileName: string,
	accessGroupId: string,
): Promise<void> {
	console.log(`Processing document: ${fileName}...`);

	// Read and upload file
	const filePath = resolve(defaultDocumentsDir, fileName);
	const fileBuffer = readFileSync(filePath);
	const file = new File([new Uint8Array(fileBuffer)], fileName, {
		type: "application/pdf",
	});

	// Store in access group folder
	const sourceUrl = `${accessGroupId}/${fileName}`;

	console.log(`Uploading ${fileName} to ${bucketName}/${sourceUrl}...`);
	const { error: uploadError } = await serviceRoleDbClient.storage
		.from(bucketName)
		.upload(sourceUrl, file, { upsert: true });

	if (uploadError) {
		console.error("Error uploading file to storage:", uploadError);
		process.exit(1);
	}

	console.log(`File uploaded successfully to ${bucketName}/${sourceUrl}`);

	const dbService = new PrivilegedDbService(serviceRoleDbClient);
	const generationService = new GenerationService(dbService);
	const embeddingService = new EmbeddingService(dbService);

	const document: Document = {
		source_url: sourceUrl,
		source_type: sourceType,
		file_size: file.size,
		created_at: new Date().toISOString(),
		access_group_id: accessGroupId,
	};
	try {
		const extractionResult = await dbService.extractDocument(document);

		const documentForProcessing: Document = {
			...document,
			file_checksum: extractionResult.checksum,
			file_size: extractionResult.fileSize,
			num_pages: extractionResult.numPages,
		};

		const llmIdentifier = config.defaultDocumentProcessingModel;
		const [summaryData, embeddings] = await Promise.all([
			generationService.summarize(
				extractionResult.parsedPages,
				llmIdentifier,
				documentForProcessing,
			),
			embeddingService.batchEmbed(
				extractionResult.parsedPages,
				documentForProcessing,
				{
					chunkingTechnique: "markdown",
				},
			),
		]);

		await dbService.logProcessedDocument(
			documentForProcessing,
			summaryData,
			embeddings,
		);
	} catch (error) {
		console.error("Error processing document:", error);
		if (sourceUrl !== null && bucketName !== null) {
			try {
				await dbService.deleteFileFromStorage(sourceUrl, bucketName);
			} catch (cleanupError) {
				throw new Error(
					`Failed to cleanup document ${sourceUrl} after processing error: ${cleanupError}`,
				);
			}
		}
		process.exit(1);
	}

	console.log(
		`Default document ${fileName} uploaded and processed successfully!`,
	);
}

async function uploadDefaultDocument() {
	try {
		assertTargetAllowed();

		const pdfFiles = await getPdfFiles();

		if (pdfFiles.length === 0) {
			console.log(
				"No PDF files found in src/default_documents/ directory. Exiting.",
			);
			return;
		}

		console.log(
			`Found ${pdfFiles.length} PDF file(s) to process: ${pdfFiles.join(", ")}`,
		);

		// Get access group ID once for all documents
		const accessGroupId = await getDefaultAccessGroupId();

		// Process each PDF file
		for (const fileName of pdfFiles) {
			console.log(`\n=== Processing ${fileName} ===`);

			// Check if already processed
			const isProcessed = await checkExistingDocument(fileName, accessGroupId);
			if (isProcessed) {
				console.log(
					`Default document ${fileName} already exists and is processed. Skipping.`,
				);
				continue;
			}

			// Process the document
			await processDocument(fileName, accessGroupId);
		}

		console.log("\n=== All default documents processed successfully! ===");
		process.exit(0);
	} catch (error) {
		console.error("Unexpected error:", error);
		process.exit(1);
	}
}

uploadDefaultDocument().catch((error) => {
	console.error("Unhandled error:", error);
	process.exit(1);
});
