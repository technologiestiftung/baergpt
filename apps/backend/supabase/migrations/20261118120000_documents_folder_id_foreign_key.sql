-- documents.folder_id had no foreign key (it was lost when registered_documents
-- was merged into documents), so a document could point at a folder that was
-- deleted in the meantime (e.g. in another browser tab) and silently vanish.

-- Backfill: move documents with a dead folder_id back to the main collection.
-- The update_folder_id_cascading trigger keeps summaries and chunks in sync.
UPDATE public.documents d
SET
    folder_id = NULL
WHERE
    d.folder_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM public.document_folders f
        WHERE f.id = d.folder_id
    );

-- NOT VALID + a separate VALIDATE CONSTRAINT avoids holding a table-locking
-- scan of `documents` for the duration of validation (see sibling migrations
-- 20261030102904, 20261006113959, 20261105110456 for the same pattern).
ALTER TABLE public.documents
ADD CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders (id) ON DELETE SET NULL NOT VALID;

ALTER TABLE public.documents
VALIDATE CONSTRAINT documents_folder_id_fkey;
