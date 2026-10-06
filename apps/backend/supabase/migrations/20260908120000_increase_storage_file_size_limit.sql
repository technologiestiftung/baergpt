-- Increase bucket file size limit from 10 MB to 20 MB
-- 20 MB = 20971520 bytes
UPDATE storage.buckets
SET
    file_size_limit = 20971520
WHERE
    id IN ('documents', 'public_documents');
