import { supabase } from "../supabase";
import {
	type Document,
	type Embedding,
	type ExtractionResult,
	type HybridSearchResult,
	type KnowledgeBaseDocument,
	type LLMIdentifier,
	DocumentNotFoundError,
} from "../types/common";
import { ragSearchDefaults } from "../constants";
import {
	DocumentExtractionService,
	WordDocumentExtractionService,
} from "./document-extraction-service";
import { captureError } from "../monitoring/capture-error";
import { EmbeddingService } from "./embedding-service";
import { GenerationService } from "./generation-service";
import { config } from "../config";

const documentExtraction = new DocumentExtractionService();
const wordExtractionService = new WordDocumentExtractionService();

export class DatabaseService {
	async logSummarizedDocument(
		summaryData: {
			summary: string;
			shortSummary: string;
			tags: string[];
			summaryEmbedding: number[];
		},
		documentData: Document,
	): Promise<void> {
		const { error } = await supabase.from("document_summaries").insert({
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
		const { error: summariesError, data: summaries } = await supabase
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
		const { error, data } = await supabase.rpc(procedure, {
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
		const { error: uploadError } = await supabase.storage
			.from(bucket)
			.upload(filePath, file);

		if (uploadError) {
			throw uploadError;
		}
	}

	async updateUserColumnValue(
		userId: string,
		columnName: string,
		amount: number = 1,
	): Promise<void> {
		const { error } = await supabase.rpc("change_value_for_user_by", {
			amount,
			column_name: columnName,
			user_id_to_update: userId,
		});

		if (error) {
			throw error;
		}
	}

	async logDocument(document: Document): Promise<number> {
		if (!document) {
			throw new Error("Document is undefined");
		}

		const { data, error } = await supabase
			.from("documents")
			.insert({
				owned_by_user_id: document.owned_by_user_id || null,
				file_checksum: document.file_checksum || null,
				file_size: document.file_size || null,
				num_pages: document.num_pages || null,
				processing_finished_at: document.processing_finished_at || null,
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

		return data[0].id;
	}

	async logEmbeddings(
		embeddings: Embedding[],
		document: Document,
	): Promise<void> {
		const { error } = await supabase.from("document_chunks").insert(
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

	async updateMetadataOfLoggedDocument(
		extractionResult: ExtractionResult,
		file_id: number,
	): Promise<Document> {
		const { data, error } = await supabase
			.from("documents")
			.update({
				file_checksum: extractionResult.checksum,
				file_size: extractionResult.fileSize,
				num_pages: extractionResult.numPages,
				processing_finished_at: new Date().toISOString(),
			})
			.eq("id", file_id)
			.select("*");

		if (error) {
			throw error;
		}

		return data[0];
	}

	async logAndExtractDocument(
		document: Document,
	): Promise<ExtractionResult & { document: Document }> {
		const documentId = await this.logDocument(document);
		const documentWithId = { ...document, id: documentId };
		const fileName = document.source_url.split("/").pop();
		const bucket =
			document.source_type === "public_document" ||
			document.source_type === "default_document"
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
			documentWithId,
		);
		const updatedDocument = await this.updateMetadataOfLoggedDocument(
			extractionResult,
			documentId,
		);

		return { ...extractionResult, document: updatedDocument };
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
		const { data, error } = await supabase.storage
			.from(bucket)
			.download(sourceUrl);

		if (!data) {
			throw new Error(`Could not download ${sourceUrl}: ${error}`);
		}

		// Convert the Blob to a Buffer
		const buffer = new Uint8Array(await data.arrayBuffer());

		return buffer;
	}

	async finishProcessing(document: Document) {
		const { error } = await supabase
			.from("documents")
			.update({ processing_finished_at: new Date().toISOString() })
			.eq("id", document.id);

		if (error) {
			throw error;
		}

		await this.updateUserDocumentCount(
			document.owned_by_user_id || document.uploaded_by_user_id,
		);
	}

	/**
	 * Processes a document: extracts, summarizes, embeds, and marks as finished.
	 * This is a shared method used by both the API route and setup scripts.
	 */
	async processDocument(document: Document): Promise<void> {
		const embeddingService = new EmbeddingService();
		const generationService = new GenerationService();
		const llmIdentifier = config.defaultModelIdentifier as LLMIdentifier;

		const extractionResult = await this.logAndExtractDocument(document);
		const extractedDocument = extractionResult.document;

		const parsedPages = extractionResult.parsedPages;
		await Promise.all([
			generationService.summarize(
				parsedPages,
				llmIdentifier,
				extractedDocument,
			),
			embeddingService.batchEmbed(parsedPages, extractedDocument, {
				chunkingTechnique: "markdown",
			}),
		]);

		await this.finishProcessing(extractedDocument);
	}

	// Updates the user's document count in the profiles table
	async updateUserDocumentCount(userId: string): Promise<void> {
		const { count, error: countError } = await supabase
			.from("documents")
			.select("*", { count: "exact", head: true })
			.eq("owned_by_user_id", userId);

		if (countError) {
			throw countError;
		}

		const documentCount = count || 0;
		const { error: updateError } = await supabase
			.from("profiles")
			.update({ num_documents: documentCount })
			.eq("id", userId);

		if (updateError) {
			throw updateError;
		}
	}

	// get user admin status from application_admins table
	async getUserAdminStatus(userId: string): Promise<boolean> {
		const { count, error } = await supabase
			.from("application_admins")
			.select("user_id", { count: "exact", head: true })
			.eq("user_id", userId);

		if (error) {
			throw error;
		}

		const isAdmin = count > 0;
		return isAdmin;
	}

	async getUserActiveStatus(userId: string) {
		const { data, error } = await supabase
			.from("user_active_status")
			.select("*")
			.eq("id", userId)
			.single();

		if (error) {
			throw error;
		}

		return data;
	}

	async getMaintenanceModeStatus(): Promise<{ is_enabled: boolean }> {
		const { data, error } = await supabase.rpc("get_maintenance_mode_status");

		if (error) {
			throw error;
		}

		return { is_enabled: data };
	}

	//update user first_name, last_name, academic_title, and email
	async updateUserProfile({
		userId,
		firstName,
		lastName,
		academic_title,
		email,
		personal_title,
	}: {
		userId: string;
		firstName?: string;
		lastName?: string;
		academic_title?: string;
		email?: string;
		personal_title?: string;
	}): Promise<void> {
		// Prepare auth update data
		const authUpdateData: {
			user_metadata?: { first_name?: string; last_name?: string };
			email?: string;
		} = {};

		// Add user metadata if firstName or lastName are provided
		if (firstName !== undefined || lastName !== undefined) {
			authUpdateData.user_metadata = {
				first_name: firstName,
				last_name: lastName,
			};
		}

		// Add email if provided
		if (email !== undefined) {
			authUpdateData.email = email;
		}

		// Update user in auth
		if (Object.keys(authUpdateData).length > 0) {
			const { error: authError } = await supabase.auth.admin.updateUserById(
				userId,
				authUpdateData,
			);

			if (authError) {
				throw authError;
			}
		}

		// Update first_name, last_name, academic_title and personal_title in profiles table
		const updateData = Object.fromEntries(
			Object.entries({
				first_name: firstName,
				last_name: lastName,
				academic_title: academic_title,
				personal_title: personal_title,
			}).filter(([, value]) => value !== undefined),
		);

		if (Object.keys(updateData).length > 0) {
			const { error: profileError } = await supabase
				.from("profiles")
				.update(updateData)
				.eq("id", userId);

			if (profileError) {
				throw profileError;
			}
		}
	}

	// Updates the admin status of a user
	async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
		if (typeof isAdmin !== "boolean") {
			throw new Error("isAdmin must be a boolean value");
		}

		if (isAdmin) {
			// Add user to application_admins table
			const { error } = await supabase
				.from("application_admins")
				.insert({ user_id: userId });

			if (error) {
				throw error;
			}

			return;
		}

		// Remove user from application_admins table
		const { error } = await supabase
			.from("application_admins")
			.delete()
			.eq("user_id", userId);

		if (error) {
			throw error;
		}
	}

	// Soft delete a user by setting deleted_at timestamp
	async softDeleteUser(userId: string): Promise<void> {
		const { error } = await supabase
			.from("user_active_status")
			.update({ deleted_at: new Date().toISOString(), is_active: false })
			.eq("id", userId);

		if (error) {
			throw error;
		}
	}

	// Hard delete a user (permanently removes from auth and cascades to profile)
	async hardDeleteUser(userId: string): Promise<void> {
		// This will permanently delete the user from auth.users
		// The profile will be automatically deleted due to CASCADE foreign key
		const { error } = await supabase.auth.admin.deleteUser(userId);

		if (error) {
			throw error;
		}
	}

	// Restore a soft-deleted user
	async restoreUser(userId: string): Promise<void> {
		const { error } = await supabase
			.from("user_active_status")
			.update({ deleted_at: null, is_active: true })
			.eq("id", userId);

		if (error) {
			throw error;
		}
	}

	// Sent out invite link to user
	async sendInviteLink(
		email: string,
		firstName?: string,
		lastName?: string,
	): Promise<void> {
		const data: { first_name?: string; last_name?: string } = {};

		if (firstName) {
			data.first_name = firstName;
		}
		if (lastName) {
			data.last_name = lastName;
		}

		const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
			data,
		});

		if (error) {
			throw error;
		}
	}

	async deleteDocument(documentId: number, userId: string): Promise<void> {
		const isAdmin = await this.getUserAdminStatus(userId);

		let query = supabase
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
		const { error: updateError } = await supabase
			.from("profiles")
			.update({ num_documents: documentCount })
			.eq("id", userId);

		if (updateError) {
			throw updateError;
		}
	}

	async getDocumentCountPerUser(userId: string): Promise<number> {
		const { count, error: countingError } = await supabase
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
		const { data, error } = await supabase.rpc("get_base_knowledge_documents", {
			input_user_id: user_id,
		});

		if (error) {
			throw error;
		}

		return (data as KnowledgeBaseDocument[]) || [];
	}
}
