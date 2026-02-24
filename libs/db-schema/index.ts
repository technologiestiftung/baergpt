export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			access_group_members: {
				Row: {
					access_group_id: string;
					created_at: string | null;
					updated_at: string | null;
					user_id: string;
				};
				Insert: {
					access_group_id: string;
					created_at?: string | null;
					updated_at?: string | null;
					user_id: string;
				};
				Update: {
					access_group_id?: string;
					created_at?: string | null;
					updated_at?: string | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "access_group_members_access_group_id_fkey";
						columns: ["access_group_id"];
						isOneToOne: false;
						referencedRelation: "access_groups";
						referencedColumns: ["id"];
					},
				];
			};
			access_groups: {
				Row: {
					created_at: string | null;
					id: string;
					name: string;
					subset_of: string | null;
					updated_at: string | null;
				};
				Insert: {
					created_at?: string | null;
					id?: string;
					name: string;
					subset_of?: string | null;
					updated_at?: string | null;
				};
				Update: {
					created_at?: string | null;
					id?: string;
					name?: string;
					subset_of?: string | null;
					updated_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "access_groups_subset_of_fkey";
						columns: ["subset_of"];
						isOneToOne: false;
						referencedRelation: "access_groups";
						referencedColumns: ["id"];
					},
				];
			};
			allowed_email_domains: {
				Row: {
					domain: string;
					id: number;
				};
				Insert: {
					domain: string;
					id?: number;
				};
				Update: {
					domain?: string;
					id?: number;
				};
				Relationships: [];
			};
			application_admins: {
				Row: {
					id: number;
					user_id: string;
				};
				Insert: {
					id?: number;
					user_id: string;
				};
				Update: {
					id?: number;
					user_id?: string;
				};
				Relationships: [];
			};
			chat_message_citations: {
				Row: {
					created_at: string;
					document_chunk_ids: number[];
					external_citation_ids: string[];
					id: number;
					message_id: number;
				};
				Insert: {
					created_at?: string;
					document_chunk_ids?: number[];
					external_citation_ids?: string[];
					id?: number;
					message_id: number;
				};
				Update: {
					created_at?: string;
					document_chunk_ids?: number[];
					external_citation_ids?: string[];
					id?: number;
					message_id?: number;
				};
				Relationships: [
					{
						foreignKeyName: "chat_message_citations_message_id_fkey";
						columns: ["message_id"];
						isOneToOne: false;
						referencedRelation: "chat_messages";
						referencedColumns: ["id"];
					},
				];
			};
			chat_messages: {
				Row: {
					allowed_document_ids: number[] | null;
					allowed_folder_ids: number[] | null;
					chat_id: number;
					citations: Json | null;
					content: string;
					created_at: string;
					id: number;
					role: string;
					type: string;
				};
				Insert: {
					allowed_document_ids?: number[] | null;
					allowed_folder_ids?: number[] | null;
					chat_id: number;
					citations?: Json | null;
					content: string;
					created_at?: string;
					id?: number;
					role: string;
					type: string;
				};
				Update: {
					allowed_document_ids?: number[] | null;
					allowed_folder_ids?: number[] | null;
					chat_id?: number;
					citations?: Json | null;
					content?: string;
					created_at?: string;
					id?: number;
					role?: string;
					type?: string;
				};
				Relationships: [
					{
						foreignKeyName: "chat_messages_chat_id_fkey";
						columns: ["chat_id"];
						isOneToOne: false;
						referencedRelation: "chats";
						referencedColumns: ["id"];
					},
				];
			};
			chats: {
				Row: {
					created_at: string;
					id: number;
					name: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: number;
					name: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: number;
					name?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			document_chunks: {
				Row: {
					access_group_id: string | null;
					chunk_index: number;
					chunk_jina_embedding: string | null;
					content: string;
					document_id: number | null;
					folder_id: number | null;
					full_text_search: unknown;
					id: number;
					owned_by_user_id: string | null;
					page: number;
				};
				Insert: {
					access_group_id?: string | null;
					chunk_index: number;
					chunk_jina_embedding?: string | null;
					content: string;
					document_id?: number | null;
					folder_id?: number | null;
					full_text_search?: unknown;
					id?: number;
					owned_by_user_id?: string | null;
					page: number;
				};
				Update: {
					access_group_id?: string | null;
					chunk_index?: number;
					chunk_jina_embedding?: string | null;
					content?: string;
					document_id?: number | null;
					folder_id?: number | null;
					full_text_search?: unknown;
					id?: number;
					owned_by_user_id?: string | null;
					page?: number;
				};
				Relationships: [
					{
						foreignKeyName: "document_chunks_access_group_id_fkey";
						columns: ["access_group_id"];
						isOneToOne: false;
						referencedRelation: "access_groups";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "document_chunks_document_id_fkey";
						columns: ["document_id"];
						isOneToOne: false;
						referencedRelation: "documents";
						referencedColumns: ["id"];
					},
				];
			};
			document_folders: {
				Row: {
					created_at: string;
					id: number;
					name: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: number;
					name: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: number;
					name?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			document_summaries: {
				Row: {
					access_group_id: string | null;
					document_id: number | null;
					folder_id: number | null;
					id: number;
					owned_by_user_id: string | null;
					short_summary: string | null;
					summary: string;
					summary_jina_embedding: string | null;
					tags: string[];
				};
				Insert: {
					access_group_id?: string | null;
					document_id?: number | null;
					folder_id?: number | null;
					id?: number;
					owned_by_user_id?: string | null;
					short_summary?: string | null;
					summary: string;
					summary_jina_embedding?: string | null;
					tags: string[];
				};
				Update: {
					access_group_id?: string | null;
					document_id?: number | null;
					folder_id?: number | null;
					id?: number;
					owned_by_user_id?: string | null;
					short_summary?: string | null;
					summary?: string;
					summary_jina_embedding?: string | null;
					tags?: string[];
				};
				Relationships: [
					{
						foreignKeyName: "document_summaries_access_group_id_fkey";
						columns: ["access_group_id"];
						isOneToOne: false;
						referencedRelation: "access_groups";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "document_summaries_document_id_fkey";
						columns: ["document_id"];
						isOneToOne: false;
						referencedRelation: "documents";
						referencedColumns: ["id"];
					},
				];
			};
			documents: {
				Row: {
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
				Insert: {
					access_group_id?: string | null;
					created_at?: string | null;
					file_checksum?: string | null;
					file_name?: string | null;
					file_size?: number | null;
					folder_id?: number | null;
					id?: number;
					num_pages?: number | null;
					owned_by_user_id?: string | null;
					processing_finished_at?: string | null;
					source_type: string;
					source_url: string;
					uploaded_by_user_id?: string | null;
				};
				Update: {
					access_group_id?: string | null;
					created_at?: string | null;
					file_checksum?: string | null;
					file_name?: string | null;
					file_size?: number | null;
					folder_id?: number | null;
					id?: number;
					num_pages?: number | null;
					owned_by_user_id?: string | null;
					processing_finished_at?: string | null;
					source_type?: string;
					source_url?: string;
					uploaded_by_user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "documents_access_group_id_fkey";
						columns: ["access_group_id"];
						isOneToOne: false;
						referencedRelation: "access_groups";
						referencedColumns: ["id"];
					},
				];
			};
			external_citations: {
				Row: {
					created_at: string;
					file_name: string;
					id: string;
					message_id: number;
					page: number;
					snippet: string;
					source_type: string;
					source_url: string;
				};
				Insert: {
					created_at: string;
					file_name: string;
					id: string;
					message_id: number;
					page: number;
					snippet: string;
					source_type?: string;
					source_url: string;
				};
				Update: {
					created_at?: string;
					file_name?: string;
					id?: string;
					message_id?: number;
					page?: number;
					snippet?: string;
					source_type?: string;
					source_url?: string;
				};
				Relationships: [
					{
						foreignKeyName: "external_citations_message_id_fkey";
						columns: ["message_id"];
						isOneToOne: false;
						referencedRelation: "chat_messages";
						referencedColumns: ["id"];
					},
				];
			};
			favorite_documents: {
				Row: {
					processed_document_id: number;
					user_id: string;
				};
				Insert: {
					processed_document_id: number;
					user_id: string;
				};
				Update: {
					processed_document_id?: number;
					user_id?: string;
				};
				Relationships: [];
			};
			maintenance_mode: {
				Row: {
					is_enabled: boolean;
					onerow_id: boolean;
					updated_at: string;
				};
				Insert: {
					is_enabled?: boolean;
					onerow_id?: boolean;
					updated_at?: string;
				};
				Update: {
					is_enabled?: boolean;
					onerow_id?: boolean;
					updated_at?: string;
				};
				Relationships: [];
			};
			profiles: {
				Row: {
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
				};
				Insert: {
					academic_title?: string | null;
					first_name?: string | null;
					id: string;
					is_addressed_formal?: boolean | null;
					last_name?: string | null;
					num_documents?: number | null;
					num_embedding_tokens?: number | null;
					num_inference_tokens?: number | null;
					num_inferences?: number | null;
					personal_title?: string | null;
				};
				Update: {
					academic_title?: string | null;
					first_name?: string | null;
					id?: string;
					is_addressed_formal?: boolean | null;
					last_name?: string | null;
					num_documents?: number | null;
					num_embedding_tokens?: number | null;
					num_inference_tokens?: number | null;
					num_inferences?: number | null;
					personal_title?: string | null;
				};
				Relationships: [];
			};
			user_active_status: {
				Row: {
					deleted_at: string | null;
					id: string;
					is_active: boolean;
					registration_finished_at: string | null;
				};
				Insert: {
					deleted_at?: string | null;
					id: string;
					is_active?: boolean;
					registration_finished_at?: string | null;
				};
				Update: {
					deleted_at?: string | null;
					id?: string;
					is_active?: boolean;
					registration_finished_at?: string | null;
				};
				Relationships: [];
			};
			user_hidden_default_documents: {
				Row: {
					created_at: string | null;
					document_id: number;
					user_id: string;
				};
				Insert: {
					created_at?: string | null;
					document_id: number;
					user_id: string;
				};
				Update: {
					created_at?: string | null;
					document_id?: number;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "user_hidden_default_documents_document_id_fkey";
						columns: ["document_id"];
						isOneToOne: false;
						referencedRelation: "documents";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "user_hidden_default_documents_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			change_value_for_user_by: {
				Args: {
					amount: number;
					column_name: string;
					user_id_to_update: string;
				};
				Returns: undefined;
			};
			delete_user: { Args: never; Returns: undefined };
			find_unprocessed_documents: {
				Args: never;
				Returns: {
					created_at: string;
					file_checksum: string;
					file_name: string;
					file_size: number;
					folder_id: number;
					id: number;
					num_pages: number;
					owned_by_user_id: string;
					processing_finished_at: string;
					source_type: string;
					source_url: string;
				}[];
			};
			get_account_activation_timestamp: { Args: never; Returns: string };
			get_allowed_email_domains: {
				Args: never;
				Returns: {
					domain: string;
					id: number;
				}[];
			};
			get_base_knowledge_documents: {
				Args: { input_user_id: string };
				Returns: {
					created_at: string;
					file_name: string;
					folder_id: number;
					id: number;
					short_summary: string;
					tags: string[];
				}[];
			};
			get_citation_details: {
				Args: { citation_ids: number[] };
				Returns: {
					citation_id: number;
					created_at: string;
					file_name: string;
					page: number;
					snippet: string;
					source_type: string;
					source_url: string;
				}[];
			};
			get_maintenance_mode_status: { Args: never; Returns: boolean };
			get_users: {
				Args: never;
				Returns: {
					academic_title: string;
					deleted_at: string;
					email: string;
					first_name: string;
					invited_at: string;
					is_active: boolean;
					is_admin: boolean;
					last_login_at: string;
					last_name: string;
					num_documents: number;
					num_embedding_tokens: number;
					num_inference_tokens: number;
					num_inferences: number;
					personal_title: string;
					registered_at: string;
					user_id: string;
				}[];
			};
			hybrid_chunk_search: {
				Args: {
					allowed_document_ids?: number[];
					allowed_folder_ids?: number[];
					full_text_weight?: number;
					match_count: number;
					query_embedding: string;
					query_text: string;
					rrf_k?: number;
					semantic_weight?: number;
				};
				Returns: {
					chunk_content: string;
					chunk_id: number;
					created_at: string;
					document_id: number;
					file_name: string;
					fts_score: number;
					hybrid_score: number;
					page: number;
					sem_score: number;
					source_type: string;
					source_url: string;
				}[];
			};
			is_application_admin: { Args: never; Returns: boolean };
			is_current_user_active: { Args: never; Returns: boolean };
			log_account_activation: { Args: never; Returns: undefined };
			match_jina_document_chunks: {
				Args: {
					allowed_document_ids: number[];
					allowed_folder_id?: number[];
					match_count: number;
					match_threshold: number;
					num_probes: number;
					query_embedding: string;
					search_type: string;
					user_id: string;
				};
				Returns: {
					content: string;
					document_id: number;
					id: number;
					similarity: number;
				}[];
			};
			match_jina_summaries: {
				Args: {
					allowed_document_ids: number[];
					allowed_folder_ids?: number[];
					match_count: number;
					match_threshold: number;
					num_probes: number;
					query_embedding: string;
					search_type: string;
					user_id: string;
				};
				Returns: {
					document_id: number;
					id: number;
					similarity: number;
					summary: string;
				}[];
			};
			match_jina_summaries_and_chunks: {
				Args: {
					allowed_document_ids: number[];
					allowed_folder_ids?: number[];
					chunk_limit: number;
					match_threshold: number;
					num_probes_chunks: number;
					num_probes_summaries: number;
					query_embedding: string;
					search_type: string;
					summary_limit: number;
					user_id: string;
				};
				Returns: {
					avg_chunk_similarity: number;
					chunk_ids: number[];
					chunk_similarities: number[];
					document_id: number;
					similarity: number;
					summary_ids: number[];
					summary_similarity: number;
				}[];
			};
			regenerate_embedding_indices_for_chunks: {
				Args: never;
				Returns: undefined;
			};
			regenerate_embedding_indices_for_summaries: {
				Args: never;
				Returns: undefined;
			};
			verify_own_password: {
				Args: { plain_password: string };
				Returns: boolean;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
	keyof Database,
	"public"
>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
				DefaultSchema["Views"])
		? (DefaultSchema["Tables"] &
				DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema["Enums"]
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {},
	},
	public: {
		Enums: {},
	},
} as const;
