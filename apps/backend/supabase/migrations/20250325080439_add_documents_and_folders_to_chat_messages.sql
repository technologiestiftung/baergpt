ALTER TABLE chat_messages
DROP COLUMN registered_document_id;

ALTER TABLE chat_messages
DROP COLUMN matching_documents;

-- Add allowed_document_ids to chat_messages
ALTER TABLE chat_messages
ADD COLUMN allowed_document_ids INT[];

-- Add allowed_folder_ids to chat_messages
ALTER TABLE chat_messages
ADD COLUMN allowed_folder_ids INT[];

-- Create function to handle document deletions and updates
CREATE OR REPLACE FUNCTION maintain_chat_messages_document_references () returns trigger AS $$
BEGIN
    -- When a document is deleted, remove it from all allowed_document_ids arrays
    IF TG_OP = 'DELETE' THEN
UPDATE chat_messages
SET allowed_document_ids = array_remove(allowed_document_ids, OLD.id)
WHERE allowed_document_ids @> ARRAY[OLD.id];
RETURN OLD;
END IF;

    -- No special handling needed for updates as the document ID remains the same
RETURN NEW;
END;
$$ language plpgsql;

-- Create function to handle folder deletions and updates
CREATE OR REPLACE FUNCTION maintain_chat_messages_folder_references () returns trigger AS $$
BEGIN
    -- When a folder is deleted, remove it from all allowed_folder_ids arrays
    IF TG_OP = 'DELETE' THEN
UPDATE chat_messages
SET allowed_folder_ids = array_remove(allowed_folder_ids, OLD.id)
WHERE allowed_folder_ids @> ARRAY[OLD.id];
RETURN OLD;
END IF;

    -- No special handling needed for updates as the folder ID remains the same
RETURN NEW;
END;
$$ language plpgsql;

-- Create triggers to maintain document references
CREATE TRIGGER trg_maintain_chat_messages_document_references before delete ON registered_documents FOR each ROW
EXECUTE function maintain_chat_messages_document_references ();

-- Create triggers to maintain folder references
CREATE TRIGGER trg_maintain_chat_messages_folder_references before delete ON document_folders FOR each ROW
EXECUTE function maintain_chat_messages_folder_references ();
