-- Drop existing overly permissive storage policies
DROP POLICY IF EXISTS "Authenticated upload resource images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update resource images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete resource images" ON storage.objects;

-- Create center-scoped upload policy
CREATE POLICY "Center users upload resource images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resource-images'
  AND public.user_belongs_to_center(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Create center-scoped update policy
CREATE POLICY "Center users update resource images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'resource-images'
  AND public.user_belongs_to_center(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Create center-scoped delete policy
CREATE POLICY "Center users delete resource images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resource-images'
  AND public.user_belongs_to_center(auth.uid(), (storage.foldername(name))[1]::uuid)
);