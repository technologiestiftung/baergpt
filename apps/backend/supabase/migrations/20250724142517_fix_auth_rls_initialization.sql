-- Fix Auth RLS Initialization Plan warnings by replacing auth.uid() with (select auth.uid())
-- Fix chats table
DROP POLICY if EXISTS "Allow authenticated users to CRUD their own chats" ON chats;

CREATE POLICY "Allow authenticated users to CRUD their own chats" ON chats FOR ALL TO authenticated USING (
    (
        SELECT
            auth.uid ()
    ) = user_id
)
WITH
    CHECK (
        (
            SELECT
                auth.uid ()
        ) = user_id
    );

-- Fix chat_messages table
DROP POLICY if EXISTS "Allow authenticated users to CRUD their own chat_messages" ON chat_messages;

CREATE POLICY "Allow authenticated users to CRUD their own chat_messages" ON chat_messages FOR ALL TO authenticated USING (
    EXISTS (
        SELECT
            1
        FROM
            chats
        WHERE
            chats.id = chat_messages.chat_id
            AND chats.user_id = (
                SELECT
                    auth.uid ()
            )
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
                AND chats.user_id = (
                    SELECT
                        auth.uid ()
                )
        )
    );

-- Fix document_folders table
DROP POLICY if EXISTS "Allow authenticated users to CRUD their own document_folders" ON document_folders;

CREATE POLICY "Allow authenticated users to CRUD their own document_folders" ON document_folders FOR ALL TO authenticated USING (
    (
        SELECT
            auth.uid ()
    ) = user_id
)
WITH
    CHECK (
        (
            SELECT
                auth.uid ()
        ) = user_id
    );

-- Fix favorite_documents table
DROP POLICY if EXISTS "Allow authenticated users to CRUD their own rows" ON favorite_documents;

CREATE POLICY "Allow authenticated users to CRUD their own rows" ON favorite_documents FOR ALL TO authenticated USING (
    (
        SELECT
            auth.uid ()
    ) = user_id
)
WITH
    CHECK (
        (
            SELECT
                auth.uid ()
        ) = user_id
    );
