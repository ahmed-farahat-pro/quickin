-- Create the storage bucket for destinations
INSERT INTO storage.buckets (id, name, public) 
VALUES ('destinations', 'destinations', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for destinations bucket

-- 1. Public Access for viewing images
CREATE POLICY "Public Access Destinations" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'destinations' );

-- 2. Authenticated users can upload destination images (Staff/Admin primarily, but using authenticated for simplicity as per existing patterns)
CREATE POLICY "Authenticated users can upload destination images" 
ON storage.objects FOR INSERT 
WITH CHECK ( 
  bucket_id = 'destinations' 
  AND auth.role() = 'authenticated' 
);

-- 3. Users can update/delete their own images (or admins, effectively)
CREATE POLICY "Users can update own destination images" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'destinations' AND auth.uid() = owner );

CREATE POLICY "Users can delete own destination images" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'destinations' AND auth.uid() = owner );
