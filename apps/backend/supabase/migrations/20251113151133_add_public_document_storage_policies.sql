-- Storage policies for public_documents bucket
-- Drop existing policies to ensure idempotency
DROP POLICY if EXISTS "Admins can insert into public_documents" ON storage.objects;

DROP POLICY if EXISTS "Admins can update public_documents" ON storage.objects;

DROP POLICY if EXISTS "Admins can delete from public_documents" ON storage.objects;

-- Allow admins to insert files
CREATE POLICY "Admins can insert into public_documents" ON storage.objects FOR insert TO authenticated
WITH
    CHECK (
        bucket_id = 'public_documents'
        AND public.is_application_admin ()
    );

-- Allow admins to update files
CREATE POLICY "Admins can update public_documents" ON storage.objects
FOR UPDATE
    TO authenticated USING (
        bucket_id = 'public_documents'
        AND public.is_application_admin ()
    )
WITH
    CHECK (
        bucket_id = 'public_documents'
        AND public.is_application_admin ()
    );

-- Allow admins to delete files
CREATE POLICY "Admins can delete from public_documents" ON storage.objects FOR delete TO authenticated USING (
    bucket_id = 'public_documents'
    AND public.is_application_admin ()
);
