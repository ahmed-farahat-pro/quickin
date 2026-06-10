-- Create the listing_best_offers table
CREATE TABLE IF NOT EXISTS public.listing_best_offers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.listing_best_offers ENABLE ROW LEVEL SECURITY;

-- Policies
-- Hosts can view their own offers
CREATE POLICY "Hosts can view own offers" ON public.listing_best_offers
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.listings WHERE id = listing_id));

-- Hosts can insert offers for their own listings
CREATE POLICY "Hosts can insert own offers" ON public.listing_best_offers
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.listings WHERE id = listing_id));

-- Admins can view all offers
CREATE POLICY "Admins can view all offers" ON public.listing_best_offers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
        )
    );

-- Admins can update offers (approve/reject)
CREATE POLICY "Admins can update offers" ON public.listing_best_offers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
        )
    );

-- Create index for faster queries on listing_id and status
CREATE INDEX IF NOT EXISTS idx_listing_best_offers_listing_id ON public.listing_best_offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_best_offers_status ON public.listing_best_offers(status);;
