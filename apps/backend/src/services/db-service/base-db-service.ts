import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";

import { StorageApiError, StorageUnknownError } from "@supabase/storage-js";

import {
	type Document,
	type Embedding,
	type ExtractionResult,
	type HybridSearchResult,
	type KnowledgeBaseDocument,
	DocumentNotFoundError,
} from "../../types/common";
import { ragSearchDefaults } from "../../constants";
import {
	DocumentExtractionService,
	WordDocumentExtractionService,
} from "../document-extraction-service";
import { captureError } from "../../monitoring/capture-error";
const documentExtraction = new DocumentExtractionService();
const wordExtractionService = new WordDocumentExtractionService();

export abstract class BaseContentDbService {
	protected abstract client: SupabaseClient<Database>;

	async logSummarizedDocument(
		summaryData: {
			summary: string;
			shortSummary: string;
			tags: string[];
			summaryEmbedding: number[];
		},
		documentData: Document,
	): Promise<void> {
		const { error } = await this.client.from("document_summaries").insert({
			owned_by_user_id: documentData.owned_by_user_id || null,
			summary: summaryData.summary,
			short_summary: summaryData.shortSummary,
			summary_jina_embedding: `[${summaryData.summaryEmbedding.join(",")}]`,
			tags: summaryData.tags,
			document_id: documentData.id,
			folder_id: documentData.folder_id,
			access_group_id: documentData.access_group_id || null,
		});

		if (error) {
			throw error;
		}
		return;
	}
	async retrieveSummaries(documentIds: number[]): Promise<Map<number, string>> {
		const { error: summariesError, data: summaries } = await this.client
			.from("document_summaries")
			.select("document_id, summary")
			.in("document_id", documentIds);

		if (summariesError) {
			throw new Error("Failed to find summaries");
		}

		return new Map(summaries.map((s) => [s.document_id, s.summary]));
	}

	/**
	 * Performs a hybrid search combining full-text and semantic vector search.
	 */
	async performHybridChunkSearch(
		embedding: number[],
		filterOptions: {
			queryText: string;
			allowed_document_ids?: number[];
			allowed_folder_ids?: number[];
		},
		maxChunks: number = ragSearchDefaults.chunk_limit,
	): Promise<HybridSearchResult[]> {
		const procedure = "hybrid_chunk_search";
		const { error, data } = await this.client.rpc(procedure, {
			query_text: filterOptions.queryText,
			query_embedding: JSON.stringify(embedding),
			match_count: maxChunks,
			allowed_document_ids: filterOptions.allowed_document_ids,
			allowed_folder_ids: filterOptions.allowed_folder_ids,
		});

		if (error) {
			throw error;
		}

		return data;
	}

	async uploadFileToStorage(
		filePath: string,
		file: File,
		bucket: string,
	): Promise<void> {
		const { error: uploadError } = await this.client.storage
			.from(bucket)
			.upload(filePath, file);

		if (uploadError) {
			throw uploadError;
		}
	}

	async deleteFileFromStorage(
		source_url: string,
		bucket: string,
	): Promise<void> {
		const { error: deletionError } = await this.client.storage
			.from(bucket)
			.remove([source_url]);

		if (!deletionError) {
			return;
		}

		if (
			deletionError instanceof StorageApiError &&
			deletionError.status === 404
		) {
			console.warn(
				`Attempted to delete ${bucket}/${source_url}, but it was already gone.`,
			);
			return;
		}

		if (deletionError instanceof StorageUnknownError) {
			console.warn(
				`Transient storage error while deleting ${bucket}/${source_url}`,
				deletionError.originalError ?? deletionError,
			);
			return;
		}

		throw deletionError;
	}

	abstract updateUserColumnValue(
		userId: string,
		columnName: string,
		amount: number,
	): Promise<void>;

	/**
	 * Creates a complete document record with all metadata, summary, and embeddings in the database.
	 */
	async logProcessedDocument(
		document: Document,
		summaryData: {
			summary: string;
			shortSummary: string;
			tags: string[];
			summaryEmbedding: number[];
		},
		embeddings: Embedding[],
	): Promise<void> {
		if (!document) {
			throw new Error("Document is undefined");
		}

		// 1. Insert Document
		const { data, error } = await this.client
			.from("documents")
			.insert({
				owned_by_user_id: document.owned_by_user_id || null,
				file_checksum: document.file_checksum,
				file_size: document.file_size,
				num_pages: document.num_pages,
				processing_finished_at: new Date().toISOString(),
				folder_id: document.folder_id || null,
				source_url: document.source_url,
				source_type: document.source_type,
				file_name: document.source_url?.split("/").pop(),
				created_at: document.created_at || new Date().toISOString(),
				access_group_id: document.access_group_id || null,
				uploaded_by_user_id: document.uploaded_by_user_id || null,
			})
			.select("*");

		if (error) {
			throw error;
		}

		if (!data || data.length === 0) {
			throw new Error("Document insert returned no data");
		}

		const newDocument = data[0];
		const documentId = newDocument.id;

		try {
			// 2. Insert Summary
			await this.logSummarizedDocument(summaryData, {
				...document,
				id: documentId,
			});

			// 3. Insert Embeddings
			await this.logEmbeddings(embeddings, { ...document, id: documentId });

			// 4. Update user document count
			const userId = document.owned_by_user_id || document.uploaded_by_user_id;
			if (userId) {
				await this.updateUserDocumentCount(userId);
			}

			return null;
		} catch (innerError) {
			// If saving aux data fails, we should cleanup the document to avoid partial state
			await this.deleteDocumentById(documentId);
			throw innerError;
		}
	}

	/**
	 * Cleanup helper for `logProcessedDocument`.
	 * Deletes a document by its ID after a partial save failure.
	 * Only logs errors rather than throwing them to avoid masking the original error.
	 */
	private async deleteDocumentById(documentId: number): Promise<void> {
		const { error } = await this.client
			.from("documents")
			.delete()
			.eq("id", documentId);

		if (error) {
			console.error(
				`Failed to cleanup document ${documentId} after partial save failure:`,
				error,
			);
		}
	}

	async logEmbeddings(
		embeddings: Embedding[],
		document: Document,
	): Promise<void> {
		const { error } = await this.client.from("document_chunks").insert(
			embeddings.map((e) => ({
				owned_by_user_id: document.owned_by_user_id || null,
				content: e.content,
				chunk_jina_embedding: JSON.stringify(e.embedding),
				chunk_index: e.chunkIndex,
				document_id: document.id,
				folder_id: document.folder_id,
				page: e.page,
				access_group_id: document.access_group_id || null,
			})),
		);

		if (error) {
			throw error;
		}
	}

	async extractDocument(document: Document): Promise<ExtractionResult> {
		const fileName = document.source_url.split("/").pop();
		const bucket = ["public_document", "default_document"].includes(
			document.source_type,
		)
			? "public_documents"
			: "documents";
		try {
			if (/\.(docx)$/i.test(fileName)) {
				const wordBuffer = await this.getDocumentBufferFromSupabase(
					bucket,
					document.source_url,
				);
				const pdfBuffer = await wordExtractionService.convertDocxToPdf(
					Buffer.from(wordBuffer),
				);
				await this.uploadFileToStorage(
					document.source_url.replace(/\.(docx)$/i, ".pdf"),
					new File([pdfBuffer], fileName.replace(/\.(docx)$/i, ".pdf"), {
						type: "application/pdf",
					}),
					bucket,
				);
			}
		} catch (error) {
			captureError(error);
		}
		const fileBytes = await this.getDocumentBufferFromSupabase(
			bucket,
			document.source_url,
		);
		const extractionResult = await documentExtraction.extractDocument(
			fileBytes,
			document,
		);

		return extractionResult;
	}

	/**
	 * Downloads a document from Supabase storage and returns it as a buffer
	 * @param document Document information
	 * @returns Buffer containing the document data
	 */
	async getDocumentBufferFromSupabase(
		bucket: string,
		sourceUrl: string,
	): Promise<Uint8Array> {
		const { data, error } = await this.client.storage
			.from(bucket)
			.download(sourceUrl);

		if (!data) {
			throw new Error(`Could not download ${sourceUrl}: ${error}`);
		}

		// Convert the Blob to a Buffer
		const buffer = new Uint8Array(await data.arrayBuffer());

		return buffer;
	}

	// Updates the user's document count in the profiles table
	async updateUserDocumentCount(userId: string): Promise<void> {
		const { count, error: countError } = await this.client
			.from("documents")
			.select("*", { count: "exact", head: true })
			.eq("owned_by_user_id", userId);

		if (countError) {
			throw countError;
		}

		const documentCount = count || 0;
		const { error: updateError } = await this.client
			.from("profiles")
			.update({ num_documents: documentCount })
			.eq("id", userId);

		if (updateError) {
			throw updateError;
		}
	}

	async getUserAdminStatus(): Promise<boolean> {
		const { data: isAdmin } = await this.client.rpc("is_application_admin");
		return isAdmin;
	}

	async getMaintenanceModeStatus(): Promise<{ is_enabled: boolean }> {
		const { data, error } = await this.client.rpc(
			"get_maintenance_mode_status",
		);

		if (error) {
			throw error;
		}

		return { is_enabled: data };
	}

	async deleteDocument(documentId: number, userId: string): Promise<void> {
		const isAdmin = await this.getUserAdminStatus();

		let query = this.client
			.from("documents")
			.delete({ count: "exact" })
			.eq("id", documentId);

		if (isAdmin) {
			// Admin can delete their own docs OR docs with null owned_by_user_id
			query = query.or(
				`owned_by_user_id.eq.${userId},owned_by_user_id.is.null`,
			);
		} else {
			// Regular users can only delete their own documents
			query = query.eq("owned_by_user_id", userId);
		}

		const { error: dbError, count: deletedDocumentsCount } = await query;

		if (dbError) {
			throw dbError;
		}

		if (!deletedDocumentsCount) {
			throw new DocumentNotFoundError(documentId);
		}

		const documentCount = await this.getDocumentCountPerUser(userId);

		// Update the user's document count
		const { error: updateError } = await this.client
			.from("profiles")
			.update({ num_documents: documentCount })
			.eq("id", userId);

		if (updateError) {
			throw updateError;
		}
	}

	async getDocumentCountPerUser(userId: string): Promise<number> {
		const { count, error: countingError } = await this.client
			.from("documents")
			.select("*", { count: "exact", head: true })
			.eq("owned_by_user_id", userId);

		if (countingError) {
			throw countingError;
		}

		return count || 0;
	}

	async getBaseKnowledgeDocuments(
		user_id: string,
	): Promise<KnowledgeBaseDocument[]> {
		const { data, error } = await this.client.rpc(
			"get_base_knowledge_documents",
			{
				input_user_id: user_id,
			},
		);

		if (error) {
			throw error;
		}

		return (data as KnowledgeBaseDocument[]) || [];
	}

	/**
	 * Validates that a folder belongs to a specific user.
	 * Returns true if the folder exists and belongs to the user, false otherwise.
	 */
	async validateFolderOwnership(
		folderId: number,
		userId: string,
	): Promise<boolean> {
		const { data, error } = await this.client
			.from("document_folders")
			.select("id")
			.eq("id", folderId)
			.eq("user_id", userId)
			.single();

		if (error) {
			// PGRST116 = no rows returned (folder doesn't exist or doesn't belong to user)
			if (error.code === "PGRST116") {
				return false;
			}
			throw error;
		}

		return data !== null;
	}

	/**
	 * Validates that a file exists in storage at the specified path.
	 * Returns true if the file exists, false otherwise.
	 */
	async validateFileExistsInStorage(
		sourceUrl: string,
		bucket: string,
	): Promise<boolean> {
		// Extract the folder (user_id or access_group_id) and filename from the path
		const pathParts = sourceUrl.split("/");
		if (pathParts.length < 2) {
			return false;
		}

		const folder = pathParts.slice(0, -1).join("/");
		const fileName = pathParts[pathParts.length - 1];

		const { data, error } = await this.client.storage
			.from(bucket)
			.list(folder, {
				search: fileName,
			});

		if (error) {
			console.error(
				`Storage error when checking file existence for ${sourceUrl} in bucket ${bucket}:`,
				error.message,
			);
			return false;
		}

		return data?.some((file) => file.name === fileName) ?? false;
	}
}
