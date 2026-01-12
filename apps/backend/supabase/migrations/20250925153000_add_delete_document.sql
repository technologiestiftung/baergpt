DROP POLICY if EXISTS "Allow authenticated users to delete documents" ON public.documents;

DROP POLICY if EXISTS "Allow owners to delete documents and admins to delete base knowledg documents" ON public.documents;

CREATE POLICY "Allow owners to delete documents and admins to delete base knowledge documents" ON public.documents FOR delete TO authenticated USING (
    owned_by_user_id = (
        SELECT
            auth.uid ()
    )
    OR (
        public.is_application_admin ()
        AND owned_by_user_id IS NULL
    )
);

CREATE OR REPLACE FUNCTION public.delete_document_and_update_count (document_id BIGINT) returns void language plpgsql security invoker
SET
    search_path = '' AS $$
declare
    acting_user_id uuid := (select auth.uid());
    deleted int;
begin
    if not exists (select 1 from public.documents where id = document_id) then
        raise exception 'document_not_found';
    end if;

    delete from public.documents
    where id = document_id
    returning 1 into deleted;

    -- non admin user trying to delete public document throws not_authorized
    if deleted is null then
        raise exception 'unauthorized';
    end if;

    update public.profiles
    set num_documents = (
        select count(*) from public.documents where owned_by_user_id = acting_user_id
    )
    where id = acting_user_id;
end;
$$;

GRANT
EXECUTE ON function public.delete_document_and_update_count (BIGINT) TO authenticated;
