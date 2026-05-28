import type { WebCitationSource } from "./api/chat/get-completion";

export type NewChatMessage = Pick<
	ChatMessage,
	| "content"
	| "type"
	| "role"
	| "allowed_document_ids"
	| "allowed_folder_ids"
	| "citations"
	| "web_citations"
>;

export type ChatWithMessages = Chat & { messages: ChatMessage[] };

export type McpOptions = "parla";
export type ChatOption = "webSearch" | McpOptions;

export const EXTERNAL_TOOL_PRIVACY_CONFIG: Partial<
	Record<
		ChatOption,
		{
			displayName: string;
		}
	>
> = {
	webSearch: { displayName: "Websuche" },
	parla: { displayName: "Parla" },
};

export type ChatOptionsDropdownValue = ChatOption | "mcpServer";

export type LlmModel = "mistral-small" | "mistral-large";

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
	web_citations: WebCitationSource[] | null;
	created_at: string;
	id: number;
	role: string;
	type: string;
};

export type UserFolder = {
	created_at: string;
	id: number;
	name: string;
	user_id: string;
};

export type PublicFolder = {
	id: number;
	name: string;
};

export type SourceType =
	| "public_document"
	| "personal_document"
	| "default_document";

export type Document = UserDocument | PublicDocument;

export type UserDocument = {
	created_at: string | null;
	file_checksum: string | null;
	file_name: string | null;
	file_size: number | null;
	folder_id: number | null;
	id: number;
	num_pages: number | null;
	owned_by_user_id: string | null;
	processing_finished_at: string | null;
	source_type: "personal_document" | "default_document";
	source_url: string;
};

export type PublicDocument = {
	created_at: string | null;
	file_checksum: string | null;
	file_name: string | null;
	file_size: number | null;
	folder_id: number | null;
	id: number;
	num_pages: number | null;
	owned_by_user_id: string | null;
	processing_finished_at: string | null;
	source_type: "public_document";
	source_url: string;
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
