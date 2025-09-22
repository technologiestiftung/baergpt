export type User = {
	user_id: string;
	first_name: string;
	last_name: string;
	email: string;
	is_active: boolean;
	is_admin?: boolean;
	registered_at?: string | null;
	last_login_at?: string | null;
	invited_at?: string | null;
	num_documents?: number;
	num_inferences: number;
	num_inference_tokens: number;
	num_embedding_tokens: number;
	academic_title?: string | null;
	personal_title?: string | null;
	deleted_at?: string | null;
	status?: "active" | "inactive" | "admin" | "invited";
};

export type UserProfile = {
	academic_title: string | null;
	first_name: string | null;
	id: string;
	is_addressed_formal: boolean | null;
	last_name: string | null;
	num_documents: number | null;
	num_embedding_tokens: number | null;
	num_inference_tokens: number | null;
	num_inferences: number | null;
	personal_title: string | null;
	deleted_at?: string | null;
};

export type Document = {
	access_group_id: string | null;
	created_at: string | null;
	file_checksum: string | null;
	file_name: string | null;
	file_size: number | null;
	folder_id: number | null;
	id: number;
	num_pages: number | null;
	owned_by_user_id: string | null;
	processing_finished_at: string | null;
	source_type: string;
	source_url: string;
	uploaded_by_user_id: string | null;
};
