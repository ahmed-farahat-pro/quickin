'use server'

import { createClient } from './server'
import { createAdminClient } from './admin'
import { revalidatePath } from 'next/cache'
import { ListingCommentWithDetails } from '@/types/database'
import { MIN_DOWNVOTES_TO_HIDE_COMMENT, COMMENT_EDIT_WINDOW_MINUTES } from '@/lib/constants'

/**
 * Fetches comments for a specific listing, including user data,
 * upvotes/downvotes, and 1 level deep nested replies.
 */
export async function getListingComments(listingId: string): Promise<ListingCommentWithDetails[]> {
  const supabase = await createClient()
  if (!supabase) return []

  // Check auth user to inject `user_vote` if applicable
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id

  // 1. Fetch all comments for the listing
  const { data: comments, error } = await supabase
    .from('listing_comments')
    .select(`
      *,
      user:profiles!listing_comments_user_id_fkey(*)
    `)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true })

  if (error || !comments) return []

  // 2. Fetch all votes for these comments
  const { data: votesData, error: votesError } = await supabase
    .from('listing_comment_votes')
    .select('comment_id, user_id, vote_type')
    .in('comment_id', comments.map(c => c.id))

  const votes = votesData || []
  
  // Create a map to attach votes natively to each comment
  const enhancedComments = comments.map(comment => {
    let upvotes = 0
    let downvotes = 0
    let user_vote: 1 | -1 | null = null

    votes.forEach(vote => {
      if (vote.comment_id === comment.id) {
        if (vote.vote_type === 1) upvotes += 1
        if (vote.vote_type === -1) downvotes += 1
        if (userId && vote.user_id === userId) {
          user_vote = vote.vote_type as 1 | -1
        }
      }
    })

    return {
      ...comment,
      user: Array.isArray(comment.user) ? comment.user[0] : comment.user,
      upvotes,
      downvotes,
      user_vote,
      replies: []
    } as ListingCommentWithDetails
  })

  // 3. Check for admin roles
  const adminClient = createAdminClient()
  if (adminClient && enhancedComments.length > 0) {
    const userIds = Array.from(new Set(enhancedComments.map(c => c.user_id)))
    const { data: staffProfiles } = await adminClient
      .from('staff_profiles')
      .select('id, role')
      .in('id', userIds)
      
    if (staffProfiles) {
      enhancedComments.forEach(comment => {
        const staffDoc = staffProfiles.find(s => s.id === comment.user_id)
        if (staffDoc && comment.user) {
          ;(comment.user as any).is_admin = true
        }
      })
    }
  }

  // 4. Assemble the tree (1 level deep)
  const topLevel = enhancedComments.filter(c => !c.parent_id)
  const replies = enhancedComments.filter(c => c.parent_id)

  topLevel.forEach(tl => {
    tl.replies = replies.filter(r => r.parent_id === tl.id)
  })

  return topLevel
}

/**
 * Adds a new comment or reply to the listing
 */
export async function addComment(listingId: string, content: string, parentId?: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database unavailable' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('listing_comments')
    .insert({
      listing_id: listingId,
      user_id: user.id,
      content,
      parent_id: parentId || null
    })

  if (error) return { error: error.message }
  
  revalidatePath(`/listings/${listingId}`)
  return { success: true }
}

/**
 * Upvote or Downvote a comment
 */
export async function toggleCommentVote(commentId: string, listingId: string, voteType: 1 | -1) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database unavailable' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Check if vote already exists
  const { data: existingVote } = await supabase
    .from('listing_comment_votes')
    .select('*')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .single()

  if (existingVote) {
    if (existingVote.vote_type === voteType) {
      // Remove vote if clicking the same one again (toggle off)
      await supabase
        .from('listing_comment_votes')
        .delete()
        .eq('id', existingVote.id)
    } else {
      // Switch vote type
      await supabase
        .from('listing_comment_votes')
        .update({ vote_type: voteType })
        .eq('id', existingVote.id)
    }
  } else {
    // Insert new vote
    await supabase
      .from('listing_comment_votes')
      .insert({
        comment_id: commentId,
        user_id: user.id,
        vote_type: voteType
      })
  }

  revalidatePath(`/listings/${listingId}`)
  return { success: true }
}

/**
 * Host reports a comment for admin review
 */
export async function reportComment(commentId: string, listingId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database unavailable' }

  const { error } = await supabase
    .from('listing_comments')
    .update({ is_host_reported: true })
    .eq('id', commentId)

  if (error) return { error: error.message }
  
  revalidatePath(`/listings/${listingId}`)
  return { success: true }
}

/**
 * Admin hides or deletes a comment
 */
export async function moderateComment(commentId: string, listingId: string, action: 'hide' | 'delete') {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database unavailable' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // is_staff check is enforced by RLS, but we can attempt the query
  if (action === 'delete') {
    const { error } = await supabase
      .from('listing_comments')
      .delete()
      .eq('id', commentId)
      
    if (error) return { error: error.message }
  } else if (action === 'hide') {
    const { error } = await supabase
      .from('listing_comments')
      .update({ is_hidden: true })
      .eq('id', commentId)
      
    if (error) return { error: error.message }
  }

  revalidatePath(`/listings/${listingId}`)
  return { success: true }
}

/**
 * User edits their own comment within the allotted timeframe.
 */
export async function editComment(commentId: string, listingId: string, content: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database unavailable' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Check if comment belongs to user and is within time window
  const { data: existing, error: fetchError } = await supabase
    .from('listing_comments')
    .select('user_id, created_at')
    .eq('id', commentId)
    .single()

  if (fetchError || !existing) return { error: 'Comment not found' }
  if (existing.user_id !== user.id) return { error: 'Unauthorized' }

  const createdAt = new Date(existing.created_at).getTime()
  const now = new Date().getTime()
  const diffMinutes = (now - createdAt) / (1000 * 60)

  if (diffMinutes > COMMENT_EDIT_WINDOW_MINUTES) {
    return { error: `Editing window closed (${COMMENT_EDIT_WINDOW_MINUTES} mins limit)` }
  }

  const { error } = await supabase
    .from('listing_comments')
    .update({ content })
    .eq('id', commentId)
    // double check RLS via user_id filter
    .eq('user_id', user.id) 

  if (error) return { error: error.message }

  revalidatePath(`/listings/${listingId}`)
  return { success: true }
}

/**
 * User deletes their own comment.
 */
export async function deleteUserComment(commentId: string, listingId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database unavailable' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('listing_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id) // Enforce ownership
      
  if (error) return { error: error.message }

  revalidatePath(`/listings/${listingId}`)
  return { success: true }
}
