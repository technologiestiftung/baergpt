import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { supabase } from "../src/supabase";
import { DatabaseService } from "../src/services/database-service";
import type { Document } from "../src/types/common";

const fileName = "BaerGPT-Handbuch.pdf";
const sourceUrl = fileName; // Store at root of bucket
const sourceType = "default_document";
const bucketName = "public_documents";

const filePath = resolve(process.cwd(), `./src/default_documents/${fileName}`);

type ExistingDocument = {
	id: number;
	source_url: string;
	processing_finished_at: string | null;
	file_name: string | null;
};

async function checkExistingDocuments(): Promise<{
	existingDocuments: ExistingDocument[] | null;
	processedDocument: ExistingDocument | null;
	existingDocument: ExistingDocument | null;
}> {
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

function readFileFromDisk(): Buffer {
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

async function uploadFileToStorage(file: File): Promise<void> {
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

async function processDocument(file: File): Promise<void> {
	// eslint-disable-next-line no-console
	console.log("Processing document...");
	const documentToProcess: Document = {
		id: 0, // Will be set by logAndExtractDocument
		source_url: sourceUrl,
		source_type: sourceType,
		file_size: file.size,
		created_at: new Date().toISOString(),
	};

	const dbService = new DatabaseService();
	await dbService.processDocument(documentToProcess);

	// eslint-disable-next-line no-console
	console.log("Default document uploaded and processed successfully!");
}

async function uploadDefaultDocument() {
	try {
		const { existingDocuments, processedDocument, existingDocument } =
			await checkExistingDocuments();

		// If document is already fully processed, skip everything
		if (processedDocument) {
			// eslint-disable-next-line no-console
			console.log(
				`Default document already exists and is processed (id: ${processedDocument.id}). Skipping upload.`,
			);
			return;
		}

		// Clean up duplicates if any (keep the one we'll use)
		if (existingDocuments && existingDocuments.length > 1 && existingDocument) {
			await cleanupDuplicates(existingDocuments, existingDocument);
		}

		// Read file from disk
		const fileBuffer = readFileFromDisk();
		const file = new File([new Uint8Array(fileBuffer)], fileName, {
			type: "application/pdf",
		});

		// Upload to storage
		await uploadFileToStorage(file);

		// If an unprocessed record exists, delete it first
		if (existingDocument && !existingDocument.processing_finished_at) {
			await deleteUnprocessedRecord(existingDocument);
		}

		// Process the document
		await processDocument(file);
	} catch (error) {
		console.error("Unexpected error:", error);
		process.exit(1);
	}
}

uploadDefaultDocument().catch((error) => {
	console.error("Unhandled error:", error);
	process.exit(1);
});
