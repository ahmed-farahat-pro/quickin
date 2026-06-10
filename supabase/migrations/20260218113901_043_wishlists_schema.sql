-- Drop old table
DROP TABLE IF EXISTS public.favorites;

-- Create wishlists table
CREATE TABLE public.wishlists (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create wishlist_items table
CREATE TABLE public.wishlist_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wishlist_id uuid REFERENCES public.wishlists(id) ON DELETE CASCADE NOT NULL,
    listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(wishlist_id, listing_id)
);

-- Enable RLS
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

-- Policies for wishlists
CREATE POLICY "Users can view their own wishlists" 
    ON public.wishlists FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wishlists" 
    ON public.wishlists FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wishlists" 
    ON public.wishlists FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wishlists" 
    ON public.wishlists FOR DELETE 
    USING (auth.uid() = user_id);

-- Policies for wishlist_items
CREATE POLICY "Users can view items in their own wishlists" 
    ON public.wishlist_items FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.wishlists 
            WHERE id = wishlist_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert items into their own wishlists" 
    ON public.wishlist_items FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.wishlists 
            WHERE id = wishlist_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete items from their own wishlists" 
    ON public.wishlist_items FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.wishlists 
            WHERE id = wishlist_id 
            AND user_id = auth.uid()
        )
    );;
