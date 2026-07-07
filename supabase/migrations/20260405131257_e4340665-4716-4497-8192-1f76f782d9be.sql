CREATE POLICY "Super admins upload resource images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resource-images'
  AND has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Super admins update resource images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resource-images'
  AND has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Super admins delete resource images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'resource-images'
  AND has_role(auth.uid(), 'super_admin'::app_role)
);