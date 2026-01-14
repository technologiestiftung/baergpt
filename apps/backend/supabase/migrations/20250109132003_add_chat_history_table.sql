CREATE EXTENSION if NOT EXISTS "pg_jsonschema";

CREATE TABLE chats (
	id serial PRIMARY KEY,
	user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	name TEXT NOT NULL
);

ALTER TABLE chats enable ROW level security;

CREATE POLICY "Allow authenticated users to CRUD their own chats" ON chats FOR ALL TO authenticated USING (auth.uid () = user_id)
WITH
	CHECK (auth.uid () = user_id);

CREATE TABLE chat_messages (
	id serial PRIMARY KEY,
	chat_id INTEGER NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	role TEXT NOT NULL,
	type TEXT NOT NULL,
	content TEXT NOT NULL,
	registered_document_id INT, -- can be null
	matching_documents JSON, -- can be null
	CHECK (
		json_matches_schema (
			'{
	"type": "array",
	"items": {
		"type": "object",
		"properties": {
			"registered_document_id": { "type": "number" },
			"processed_document_id": { "type": "number" },
            "similarity": { "type": "number" },
			"processed_document_summary_match": {
				"type": "object",
				"properties": {
					"processed_document_summary_id": { "type": "number" },
					"processed_document_summary_similarity": { "type": "number" }
				}
			},
			"processed_document_chunk_matches": {
				"type": "array",
				"items": {
					"type": "object",
					"properties": {
						"processed_document_chunk_id": { "type": "number" },
						"processed_document_chunk_similarity": { "type": "number" }
					}
				}
			}
		}
	}
}'::JSON,
			matching_documents
		)
	)
);

ALTER TABLE chat_messages enable ROW level security;

CREATE POLICY "Allow authenticated users to CRUD their own chat_messages" ON chat_messages FOR ALL TO authenticated USING (
	EXISTS (
		SELECT
			1
		FROM
			chats
		WHERE
			chats.id = chat_messages.chat_id
			AND chats.user_id = auth.uid ()
	)
)
WITH
	CHECK (
		EXISTS (
			SELECT
				1
			FROM
				chats
			WHERE
				chats.id = chat_messages.chat_id
				AND chats.user_id = auth.uid ()
		)
	);
