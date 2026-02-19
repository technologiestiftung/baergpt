import type { ModelMessage, LanguageModel } from "ai";

export type Document = {
	id?: number;
	owned_by_user_id?: string;
	access_group_id?: string;
	source_url: string;
	source_type: string;
	file_checksum?: string;
	file_size?: number;
	num_pages?: number;
	folder_id?: number;
	processing_finished_at?: string;
	created_at: string;
	uploaded_by_user_id?: string;
};

export type DocumentSummary = {
	id: number;
	document_id?: number;
	owned_by_user_id?: string;
	summary: string;
	short_summary?: string;
	summary_embedding?: string;
	summary_jina_embedding?: string;
	tags: string[];
	folder_id?: number;
};

export type DocumentChunk = {
	id: number;
	document_id?: number;
	owned_by_user_id?: string;
	content: string;
	embedding?: string;
	chunk_jina_embedding?: string;
	page: number;
	chunk_index: number;
	folder_id?: number;
};

export type DocumentSummaryMatch = {
	document_summary: DocumentSummary;
	similarity: number;
};

export type DocumentChunkMatch = {
	document_chunk: DocumentChunk;
	similarity: number;
};

export type ResponseDocumentMatch = {
	document: Document;
	document_summary_match: DocumentSummaryMatch;
	document_chunk_matches: Array<DocumentChunkMatch>;
	similarity: number;
};

export type GenerateAnswerBody = {
	query: string;
	include_summary_in_response_generation: boolean;
	temperature: number;
	documentMatches: Array<ResponseDocumentMatch>;
};

export type ChatMessageBody = {
	messages: ModelMessage[];
	message_id?: number;
	user_id: string;
	chat_id: string;
	search_type: string;
	allowed_document_ids: number[];
	allowed_folder_ids: number[];
	is_addressed_formal: boolean;
	user_title: string;
	user_name: string;
	is_base_knowledge_active?: boolean;
	is_parla_mcp_tool_active?: boolean;
	llm_model: string;
};

export type Embedding = {
	content: string;
	embedding: Array<number>;
	chunkIndex: number;
	page: number;
	id: number | undefined;
	embeddingTemp: Array<number> | undefined;
};

export type EmbeddingResult = {
	document: Document;
	embeddings: Array<Embedding>;
	tokenUsage: number;
};

export type SummaryEmbeddingResult = {
	embedding: Array<number>;
	tokenUsage: number;
};

export type Chunk = {
	content: string;
	page: number;
	chunkIndex: number;
	tokenCount: number;
};

export type ExtractRequest = {
	document: Document;
	targetPath: string;
};

export type ExtractionResult = {
	document: Document;
	fileSize: number;
	numPages: number;
	checksum: string;
	parsedPages: ParsedPage[];
};

export type SummarizeResult = {
	document: Document;
	summary: string;
	shortSummary: string;
	embedding: Array<number>;
	tags: Array<string>;
	embeddingTokens: number;
	inputTokens: number;
	outputTokens: number;
};

export type TextResponse = {
	result: string;
	inputTokens: number;
	outputTokens: number;
};

export type EmbeddingResponse = {
	embedding: Array<number>;
	tokenUsage: number;
};

export type EmbeddingsResponse = {
	embeddings: number[][];
	tokenUsage: number;
};

export type TagsResponse = {
	tags: {
		tags: Array<string>;
	};
	inputTokens: number;
	outputTokens: number;
};

export type DocumentImporter = {
	documentType: string;
	settings: Settings;
	import(): Promise<number>;
};

export type Settings = {
	supabaseUrl: string;
	supabaseServiceRoleKey: string;
	mistralApiKey: string;
	mistralModel: string;
	jinaApiKey: string;
	jinaEmbeddingModel: string;
	processingBatchSize: number;
};

export type TokenUsage = {
	embeddings: number;
	inputs: number;
	outputs: number;
};

export interface SimilaritySearchResult {
	document_id: number;
	chunk_ids: number[];
	chunk_similarities: number[];
	summary_similarity: number;
	similarity: number;
}

export interface HybridSearchResult {
	document_id: number;
	chunk_id: number;
	chunk_content: string;
	page: number;
	source_url: string;
	file_name: string;
	created_at: string;
	source_type: string;
	fts_score: number;
	sem_score: number;
	hybrid_score: number;
}

export interface ParsedPage {
	content: string;
	pageNumber: number;
	tokenCount?: number;
}

export class DocumentNotFoundError extends Error {
	constructor(documentId: number) {
		super(
			`Document with ID ${documentId} not found, it may not exist or you may not have access to it.`,
		);
		this.name = "DocumentNotFoundError";
	}
}

export class DefaultDocumentDeletionError extends Error {
	constructor(documentId: number) {
		super(`Default document ${documentId} cannot be deleted.`);
		this.name = "DefaultDocumentDeletionError";
	}
}

export interface DocumentBufferResponse {
	buffer: Uint8Array;
	filename: string;
}

export interface JinaEmbeddingData {
	index: number;
	embedding: number[];
}

export interface JinaEmbeddingUsage {
	total_tokens: number;
}

export interface JinaEmbeddingResponse {
	data: JinaEmbeddingData[];
	usage: JinaEmbeddingUsage;
}

export interface JinaSegmenterResponse {
	num_tokens: number;
	num_chunks: number;
	chunks: string[];
}

export class LLMHandler {
	model: string;
	languageModel: LanguageModel;
	endpoint: string;

	constructor(model: string, languageModel: LanguageModel, endpoint: string) {
		this.model = model;
		this.languageModel = languageModel;
		this.endpoint = endpoint;
	}
}

export type UserProfile = {
	user_id: string;
	first_name: string;
	last_name: string;
	email: string;
	is_active?: boolean;
	registered_at?: string | null;
	last_login_at?: string | null;
	invited_at?: string | null;
	num_documents?: number;
	num_inferences?: number;
	num_inference_tokens?: number;
	num_embedding_tokens?: number;
	academic_title?: string | null;
	personal_title?: string | null;
	deleted_at?: string | null;
	is_admin?: boolean;
};

export type KnowledgeBaseDocument = {
	id: number;
	folder_id: number;
	created_at: string;
	file_name: string;
	short_summary: string;
	tags: string[];
};

export type AllowedEmailDomain = {
	id: number;
	domain: string;
};

export type ValidationResult =
	| { success: true; bucket: string }
	| { success: false; error: string; status: 400 | 403 | 404 };
