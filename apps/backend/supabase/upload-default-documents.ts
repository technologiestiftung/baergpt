import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { supabase } from "../src/supabase";
import { DatabaseService } from "../src/services/database-service";
import { GenerationService } from "../src/services/generation-service";
import { EmbeddingService } from "../src/services/embedding-service";
import { config } from "../src/config";
import type { Document, LLMIdentifier } from "../src/types/common";

const sourceType = "default_document";
const bucketName = "public_documents";
const defaultDocumentsDir = resolve(process.cwd(), "./src/default_documents");

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
		return []; // Unreachable, but satisfies TypeScript
	}
}

type ExistingDocument = {
	id: number;
	source_url: string;
	processing_finished_at: string | null;
	file_name: string | null;
};

async function checkExistingDocuments(fileName: string): Promise<{
	existingDocuments: ExistingDocument[] | null;
	processedDocument: ExistingDocument | null;
	existingDocument: ExistingDocument | null;
}> {
	const sourceUrl = fileName; // Store at root of bucket
	const { data: existingDocuments, error: checkError } = await supabase
		.from("documents")
		.select("id, source_url, processing_finished_at, file_name")
		.eq("source_url", sourceUrl)
		.eq("source_type", sourceType);

	if (checkError) {
		console.error("Error checking for existing document:", checkError);
		process.exit(1);
	}

	const processedDocument = existingDocuments?.find(
		(doc) => !!doc.processing_finished_at,
	) as ExistingDocument | null;

	const existingDocument = (processedDocument ??
		existingDocuments?.[0] ??
		null) as ExistingDocument | null;

	return { existingDocuments, processedDocument, existingDocument };
}

async function cleanupDuplicates(
	existingDocuments: ExistingDocument[],
	existingDocument: ExistingDocument,
): Promise<void> {
	// eslint-disable-next-line no-console
	console.log(
		`Found ${existingDocuments.length} duplicate documents. Cleaning up...`,
	);
	const idsToDelete = existingDocuments
		.filter((doc) => doc.id !== existingDocument.id)
		.map((doc) => doc.id);
	if (idsToDelete.length > 0) {
		const { error: deleteError } = await supabase
			.from("documents")
			.delete()
			.in("id", idsToDelete);
		if (deleteError) {
			console.error("Error cleaning up duplicates:", deleteError);
			// Continue anyway
		}
	}
}

function readFileFromDisk(fileName: string): Buffer {
	const filePath = resolve(defaultDocumentsDir, fileName);
	try {
		return readFileSync(filePath);
	} catch (fileError) {
		console.error(
			`Error reading file at ${filePath}:`,
			fileError instanceof Error ? fileError.message : fileError,
		);
		console.error(
			"Make sure the default document file exists in src/default_documents/",
		);
		process.exit(1);
		return Buffer.alloc(0); // Unreachable, but satisfies TypeScript
	}
}

async function uploadFileToStorage(
	file: File,
	fileName: string,
): Promise<void> {
	const sourceUrl = fileName; // Store at root of bucket
	// eslint-disable-next-line no-console
	console.log(`Uploading ${fileName} to ${bucketName} bucket...`);
	const { error: uploadError } = await supabase.storage
		.from(bucketName)
		.upload(sourceUrl, file, {
			upsert: true, // Replace if exists
		});

	if (uploadError) {
		console.error("Error uploading file to storage:", uploadError);
		process.exit(1);
	}

	// eslint-disable-next-line no-console
	console.log(`File uploaded successfully to ${bucketName}/${sourceUrl}`);
}

async function deleteUnprocessedRecord(
	existingDocument: ExistingDocument,
): Promise<void> {
	// eslint-disable-next-line no-console
	console.log(
		`Removing unprocessed record (id: ${existingDocument.id}) before processing...`,
	);
	const { error: deleteError } = await supabase
		.from("documents")
		.delete()
		.eq("id", existingDocument.id);
	if (deleteError) {
		console.error("Error deleting unprocessed record:", deleteError);
		// Continue anyway - logAndExtractDocument will handle it
	}
}

async function getDefaultAccessGroupId(): Promise<string> {
	const { data: accessGroup, error } = await supabase
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

async function processDocument(file: File, fileName: string): Promise<void> {
	// eslint-disable-next-line no-console
	console.log(`Processing document: ${fileName}...`);

	// Get the default "Alle" access group ID
	const accessGroupId = await getDefaultAccessGroupId();

	const sourceUrl = fileName; // Store at root of bucket
	const documentToProcess: Document = {
		id: 0, // Will be set by logAndExtractDocument
		source_url: sourceUrl,
		source_type: sourceType,
		file_size: file.size,
		created_at: new Date().toISOString(),
		access_group_id: accessGroupId,
	};

	const dbService = new DatabaseService();
	const generationService = new GenerationService();
	const embeddingService = new EmbeddingService();

	const llmIdentifier = config.defaultModelIdentifier as LLMIdentifier;
	const extractionResult =
		await dbService.logAndExtractDocument(documentToProcess);
	const extractedDocument = extractionResult.document;

	const parsedPages = extractionResult.parsedPages;
	await Promise.all([
		generationService.summarize(parsedPages, llmIdentifier, extractedDocument),
		embeddingService.batchEmbed(parsedPages, extractedDocument, {
			chunkingTechnique: "markdown",
		}),
	]);

	await dbService.finishProcessing(extractedDocument);

	// eslint-disable-next-line no-console
	console.log(
		`Default document ${fileName} uploaded and processed successfully!`,
	);
}

async function uploadDefaultDocument() {
	try {
		// Get all PDF files from the default_documents directory
		const pdfFiles = await getPdfFiles();

		if (pdfFiles.length === 0) {
			// eslint-disable-next-line no-console
			console.log(
				"No PDF files found in src/default_documents/ directory. Exiting.",
			);
			return;
		}

		// eslint-disable-next-line no-console
		console.log(
			`Found ${pdfFiles.length} PDF file(s) to process: ${pdfFiles.join(", ")}`,
		);

		// Process each PDF file
		for (const fileName of pdfFiles) {
			// eslint-disable-next-line no-console
			console.log(`\n=== Processing ${fileName} ===`);

			const { existingDocuments, processedDocument, existingDocument } =
				await checkExistingDocuments(fileName);

			// If document is already fully processed, skip everything
			if (processedDocument) {
				// eslint-disable-next-line no-console
				console.log(
					`Default document ${fileName} already exists and is processed (id: ${processedDocument.id}). Skipping upload.`,
				);
				continue;
			}

			// Clean up duplicates if any (keep the one we'll use)
			if (
				existingDocuments &&
				existingDocuments.length > 1 &&
				existingDocument
			) {
				await cleanupDuplicates(existingDocuments, existingDocument);
			}

			// Read file from disk
			const fileBuffer = readFileFromDisk(fileName);
			const file = new File([new Uint8Array(fileBuffer)], fileName, {
				type: "application/pdf",
			});

			// Upload to storage
			await uploadFileToStorage(file, fileName);

			// If an unprocessed record exists, delete it first
			if (existingDocument && !existingDocument.processing_finished_at) {
				await deleteUnprocessedRecord(existingDocument);
			}

			// Process the document
			await processDocument(file, fileName);
		}

		// eslint-disable-next-line no-console
		console.log("\n=== All default documents processed successfully! ===");
	} catch (error) {
		console.error("Unexpected error:", error);
		process.exit(1);
	}
}

uploadDefaultDocument().catch((error) => {
	console.error("Unhandled error:", error);
	process.exit(1);
});
