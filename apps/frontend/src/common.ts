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

export type Chat = {
	created_at: string;
	id: number;
	name: string;
	user_id: string;
};
export type ChatMessage = {
	allowed_document_ids?: number[];
	allowed_folder_ids?: number[];
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

export type SourceType = "public_document" | "personal_document";

export type Document = {
	created_at?: string;
	file_checksum?: string;
	file_name?: string;
	file_size: number;
	folder_id?: number;
	id: number;
	num_pages?: number;
	owned_by_user_id?: string;
	processing_finished_at?: string;
	source_type: SourceType;
	source_url: string;
};

export type User = {
	user_id: string;
	first_name: string;
	last_name: string;
	email: string;
	registered_at?: string | null;
	last_login_at?: string | null;
	num_documents?: number;
	num_inferences: number;
	num_inference_tokens: number;
	num_embedding_tokens: number;
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
