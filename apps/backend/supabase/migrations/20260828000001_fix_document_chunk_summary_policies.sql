-- Fix: split FOR ALL policies on document_chunks and document_summaries into
-- per-operation policies so that DELETE and UPDATE cannot target base-knowledge
-- rows (owned_by_user_id IS NULL). PostgreSQL applies only the USING clause for
-- DELETE; a FOR ALL policy whose USING permits NULL-owned rows lets any
-- authenticated user delete or poison shared base-knowledge content.

-- ── document_chunks ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated users to access own or public document_chun" ON public.document_chunks;

-- Read: own rows and public base-knowledge rows are visible.
CREATE POLICY "document_chunks_select" ON public.document_chunks
    FOR SELECT TO authenticated
    USING (
        owned_by_user_id IS NULL
        OR owned_by_user_id = (SELECT auth.uid())
    );

-- Insert: users may only insert their own rows; admins may insert base-knowledge rows.
CREATE POLICY "document_chunks_insert" ON public.document_chunks
    FOR INSERT TO authenticated
    WITH CHECK (
        owned_by_user_id = (SELECT auth.uid())
        OR (public.is_application_admin() AND owned_by_user_id IS NULL)
    );

-- Update: only the owning user may mutate their own rows.
-- Base-knowledge rows (owned_by_user_id IS NULL) are intentionally excluded.
CREATE POLICY "document_chunks_update" ON public.document_chunks
    FOR UPDATE TO authenticated
    USING (
        owned_by_user_id = (SELECT auth.uid())
    )
    WITH CHECK (
        owned_by_user_id = (SELECT auth.uid())
        OR (public.is_application_admin() AND owned_by_user_id IS NULL)
    );

-- Delete: only the owning user may delete their own rows.
-- Base-knowledge rows (owned_by_user_id IS NULL) are intentionally excluded.
CREATE POLICY "document_chunks_delete" ON public.document_chunks
    FOR DELETE TO authenticated
    USING (
        owned_by_user_id = (SELECT auth.uid())
    );

-- ── document_summaries ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated users to access own or public document_summ" ON public.document_summaries;

-- Read: own rows and public base-knowledge rows are visible.
CREATE POLICY "document_summaries_select" ON public.document_summaries
    FOR SELECT TO authenticated
    USING (
        owned_by_user_id IS NULL
        OR owned_by_user_id = (SELECT auth.uid())
    );

-- Insert: users may only insert their own rows; admins may insert base-knowledge rows.
CREATE POLICY "document_summaries_insert" ON public.document_summaries
    FOR INSERT TO authenticated
    WITH CHECK (
        owned_by_user_id = (SELECT auth.uid())
        OR (public.is_application_admin() AND owned_by_user_id IS NULL)
    );

-- Update: only the owning user may mutate their own rows.
-- Base-knowledge rows (owned_by_user_id IS NULL) are intentionally excluded.
CREATE POLICY "document_summaries_update" ON public.document_summaries
    FOR UPDATE TO authenticated
    USING (
        owned_by_user_id = (SELECT auth.uid())
    )
    WITH CHECK (
        owned_by_user_id = (SELECT auth.uid())
        OR (public.is_application_admin() AND owned_by_user_id IS NULL)
    );

-- Delete: only the owning user may delete their own rows.
-- Base-knowledge rows (owned_by_user_id IS NULL) are intentionally excluded.
CREATE POLICY "document_summaries_delete" ON public.document_summaries
    FOR DELETE TO authenticated
    USING (
        owned_by_user_id = (SELECT auth.uid())
    );
