-- Migration: receipts storage bucket and realtime on bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 1. Create a public 'receipts' bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies for receipts bucket
-- Drop policies if they already exist to be idempotent
DROP POLICY IF EXISTS "Receipts are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload a receipt" ON storage.objects;

CREATE POLICY "Receipts are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'receipts');

CREATE POLICY "Anyone can upload a receipt" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'receipts');

-- 3. Enable realtime for public.bookings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    END IF;
END $$;
;
