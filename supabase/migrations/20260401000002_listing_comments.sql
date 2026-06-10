-- Migration for Listing Comments and Votes
-- 
-- Description: Creates tables for comments beside reviews, enabling guests to comment,
-- host to reply/report, and guests to upvote/downvote.

-- 1. Create listing_comments table
CREATE TABLE IF NOT EXISTS public.listing_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.listing_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_hidden BOOLEAN DEFAULT FALSE,
    is_host_reported BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create listing_comment_votes table
CREATE TABLE IF NOT EXISTS public.listing_comment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.listing_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vote_type INTEGER NOT NULL CHECK (vote_type IN (1, -1)),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(comment_id, user_id)
);

-- 3. Create indexes for quick retrieval
CREATE INDEX IF NOT EXISTS listing_comments_listing_id_idx ON public.listing_comments (listing_id);
CREATE INDEX IF NOT EXISTS listing_comments_parent_id_idx ON public.listing_comments (parent_id);
CREATE INDEX IF NOT EXISTS listing_comment_votes_comment_id_idx ON public.listing_comment_votes (comment_id);

-- 4. Enable RLS
ALTER TABLE public.listing_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_comment_votes ENABLE ROW LEVEL SECURITY;

-- 5. Policies for listing_comments
-- Select: anyone can view
CREATE POLICY "Comments are viewable by everyone" 
    ON public.listing_comments FOR SELECT 
    USING (true);

-- Insert: authenticated users only
CREATE POLICY "Authenticated users can insert comments" 
    ON public.listing_comments FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Update: users can update own content OR admins can moderate OR host can report
CREATE POLICY "Users can update own comments, host can report, admins can moderate" 
    ON public.listing_comments FOR UPDATE 
    USING (
        auth.uid() = user_id 
        OR is_staff(auth.uid())
        OR EXISTS (SELECT 1 FROM public.listings WHERE id = listing_comments.listing_id AND user_id = auth.uid())
    );

-- Delete: admins or original author
CREATE POLICY "Admins or authors can delete their comments" 
    ON public.listing_comments FOR DELETE 
    USING (auth.uid() = user_id OR is_staff(auth.uid()));


-- 6. Policies for listing_comment_votes
-- Select: anyone can view
CREATE POLICY "Votes are viewable by everyone" 
    ON public.listing_comment_votes FOR SELECT 
    USING (true);

-- Insert: authenticated users
CREATE POLICY "Authenticated users can vote" 
    ON public.listing_comment_votes FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Update: user can change own vote
CREATE POLICY "Users can update their own vote" 
    ON public.listing_comment_votes FOR UPDATE 
    USING (auth.uid() = user_id);

-- Delete: user can remove own vote
CREATE POLICY "Users can delete their own vote" 
    ON public.listing_comment_votes FOR DELETE 
    USING (auth.uid() = user_id);


-- 7. Add updated_at trigger
DROP TRIGGER IF EXISTS update_listing_comments_updated_at ON public.listing_comments;
CREATE TRIGGER update_listing_comments_updated_at
    BEFORE UPDATE ON public.listing_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
