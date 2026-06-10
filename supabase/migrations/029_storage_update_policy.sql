-- Allow users to update (overwrite) their own identity documents
-- This is required because we use upsert: true when uploading documents
-- and previously rejected users need to overwrite their old files.

CREATE POLICY "Users can update own identity docs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'identity-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Also ensure we have the DELETE policy in case we need it later (good practice)
CREATE POLICY "Users can delete own identity docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'identity-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
