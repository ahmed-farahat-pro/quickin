-- Create the storage bucket for listings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('listings', 'listings', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for listings bucket
-- 1. Public Access for viewing
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'listings' );

-- 2. Authenticated users can upload
CREATE POLICY "Authenticated users can upload images" 
ON storage.objects FOR INSERT 
WITH CHECK ( 
  bucket_id = 'listings' 
  AND auth.role() = 'authenticated' 
);

-- 3. Users can update/delete their own images
CREATE POLICY "Users can update own images" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'listings' AND auth.uid() = owner );

CREATE POLICY "Users can delete own images" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'listings' AND auth.uid() = owner );
