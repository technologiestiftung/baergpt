export type NewChatMessage = Pick<
	ChatMessage,
	| "content"
	| "type"
	| "role"
	| "allowed_document_ids"
	| "allowed_folder_ids"
	| "citations"
>;

export type ChatWithMessages = Chat & { messages: ChatMessage[] };

export type ChatOption = "baseKnowledge" | "webSearch";

export type Chat = {
	created_at: string;
	id: number;
	name: string;
	user_id: string;
};
export type ChatMessage = {
	allowed_document_ids: number[] | null;
	allowed_folder_ids: number[] | null;
	chat_id: number;
	content: string;
	citations: number[] | null;
	created_at: string;
	id: number;
	role: string;
	type: string;
};

export type DocumentFolder = {
	created_at: string;
	id: number;
	name: string;
	user_id: string;
};

export type SourceType =
	| "public_document"
	| "personal_document"
	| "default_document";

export type Document = {
	created_at: string | null;
	file_checksum: string | null;
	file_name: string | null;
	file_size: number | null;
	folder_id: number | null;
	id: number;
	num_pages: number | null;
	owned_by_user_id: string | null;
	processing_finished_at: string | null;
	source_type: SourceType;
	source_url: string;
};

export type DocumentWithUrl = Document & {
	previewUrl?: string;
};

export type User = {
	id: string;
	first_name: string | null;
	last_name: string | null;
	registered_at?: string | null;
	last_login_at?: string | null;
	num_documents: number | null;
	num_inferences: number | null;
	num_inference_tokens: number | null;
	num_embedding_tokens: number | null;
	academic_title?: string | null;
	personal_title?: string | null;
	is_addressed_formal?: boolean | null;
};

export type CitationWithDetails = {
	snippet: string;
	page: number;
	fileName: string;
	sourceUrl: string;
	createdAt: string;
	sourceType: SourceType;
};
