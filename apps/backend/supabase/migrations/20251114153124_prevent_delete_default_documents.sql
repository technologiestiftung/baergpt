-- Prevent deletion of default documents
CREATE OR REPLACE FUNCTION public.delete_document_and_update_count (document_id BIGINT) returns void language plpgsql security invoker
SET
	search_path = '' AS $$
declare
    acting_user_id uuid := (select auth.uid());
    deleted int;
    document_source_type text;
begin
    if not exists (select 1 from public.documents where id = document_id) then
        raise exception 'document_not_found';
    end if;

    -- Prevent deletion of default documents
    select source_type into document_source_type
    from public.documents
    where id = document_id;

    if document_source_type = 'default_document' then
        raise exception 'default_documents_cannot_be_deleted';
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

