// =============================================================================
// REVIEW SERVER ACTIONS
// =============================================================================

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface CreateReviewData {
  listingId: string
  rating: number
  rating_accuracy: number
  rating_cleanliness: number
  rating_communication: number
  rating_location: number
  rating_check_in: number
  rating_value: number
  comment: string
  private_feedback?: string
}

export async function createReview(data: CreateReviewData) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database connection failed' }

  // Authenticate user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be logged in to leave a review' }
  }

  // Check for completed booking within 14 days of check_out
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, check_out')
    .eq('listing_id', data.listingId)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .single()

  if (!booking) {
    return { error: 'You can only review listings you have booked and completed' }
  }

  // Enforce 14-day window
  const checkOutDate = new Date(booking.check_out)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - checkOutDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays > 14) {
    return { error: 'The 14-day review window for this booking has closed' }
  }

  // Insert review with booking_id
  const { error } = await supabase
    .from('reviews')
    .insert({
      listing_id: data.listingId,
      user_id: user.id,
      booking_id: booking.id,
      rating: data.rating,
      rating_accuracy: data.rating_accuracy,
      rating_cleanliness: data.rating_cleanliness,
      rating_communication: data.rating_communication,
      rating_location: data.rating_location,
      rating_check_in: data.rating_check_in,
      rating_value: data.rating_value,
      comment: data.comment,
      private_feedback: data.private_feedback ? [
        {
          role: 'guest',
          message: data.private_feedback,
          created_at: new Date().toISOString(),
          sender_id: user.id
        }
      ] : [],
    })

  if (error) {
    if (error.code === '42501') return { error: 'Policy error: Cannot create review' }
    return { error: 'Failed to create review' }
  }

  // Update listing rating (optional: trigger a DB function or recalc)
  // For now, relies on next fetch to get fresh data
  
  revalidatePath(`/listings/${data.listingId}`)
  return { error: null }
}

export async function updateReview(reviewId: string, data: { 
  rating: number; 
  rating_accuracy: number;
  rating_cleanliness: number;
  rating_communication: number;
  rating_location: number;
  rating_check_in: number;
  rating_value: number;
  comment: string;
  listingId: string;
  private_feedback?: string;
}) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database connection failed' }

  // 1. Authenticate user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be logged in to update a review' }
  }

  // 2. Fetch the review and booking to check the window
  const { data: review } = await supabase
    .from('reviews')
    .select('booking_id, user_id')
    .eq('id', reviewId)
    .single()

  if (!review) {
    return { error: 'Review not found' }
  }

  if (review.user_id !== user.id) {
    return { error: 'Unauthorized to update this review' }
  }

  if (review.booking_id) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('check_out')
      .eq('id', review.booking_id)
      .single()

    if (booking) {
      const checkOutDate = new Date(booking.check_out)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - checkOutDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays > 14) {
        return { error: 'Review editing period has closed' }
      }
    }
  }

  // 3. Update review (only if window is open)
  const { error } = await supabase
    .from('reviews')
    .update({
      rating: data.rating,
      rating_accuracy: data.rating_accuracy,
      rating_cleanliness: data.rating_cleanliness,
      rating_communication: data.rating_communication,
      rating_location: data.rating_location,
      rating_check_in: data.rating_check_in,
      rating_value: data.rating_value,
      comment: data.comment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Update review error:', error)
    return { error: 'Failed to update review' }
  }

  revalidatePath(`/listings/${data.listingId}`)
  return { error: null }
}

// =============================================================================
// ADMIN REVIEW ACTIONS
// =============================================================================

export async function getAdminReviews(searchQuery?: string, filterStatus: 'all' | 'hidden' | 'visible' = 'all') {
  const supabase = await createClient()
  if (!supabase) return []

  let query = supabase
    .from('reviews')
    .select(`
      id,
      rating,
      comment,
      private_feedback,
      is_hidden,
      created_at,
      listing_id,
      user_id,
      listing:listings(id, title),
      user:profiles(id, full_name, email)
    `)
    .order('created_at', { ascending: false })

  if (searchQuery) {
    query = query.ilike('comment', `%${searchQuery}%`)
  }

  if (filterStatus === 'hidden') {
    query = query.eq('is_hidden', true)
  } else if (filterStatus === 'visible') {
    query = query.eq('is_hidden', false)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching admin reviews:', error)
    return []
  }

  return data as any[]
}

export async function toggleReviewVisibility(reviewId: string, isHidden: boolean) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database connection failed' }

  const { error } = await supabase
    .from('reviews')
    .update({ is_hidden: isHidden })
    .eq('id', reviewId)

  if (error) {
    console.error('Error toggling review visibility:', error)
    return { error: 'Failed to update review visibility' }
  }

  revalidatePath('/dashboard/admin/reviews')
  return { error: null }
}

export async function deleteReviewAdmin(reviewId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database connection failed' }

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)

  if (error) {
    console.error('Error deleting review:', error)
    return { error: 'Failed to delete review' }
  }

  revalidatePath('/dashboard/admin/reviews')
  return { error: null }
}

export async function addPrivateChatMessage(reviewId: string, message: string, role: 'host' | 'admin' | 'guest') {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database connection failed' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Authentication required' }

  // 1. Get existing chat
  const { data: review, error: fetchError } = await supabase
    .from('reviews')
    .select('private_feedback, listing_id')
    .eq('id', reviewId)
    .single()

  if (fetchError || !review) return { error: 'Review not found' }

  const chat = (review.private_feedback as any[]) || []
  
  // 2. Append new message
  const newMessage = {
    role,
    message,
    created_at: new Date().toISOString(),
    sender_id: user.id
  }

  const { error: updateError } = await supabase
    .from('reviews')
    .update({
      private_feedback: [...chat, newMessage]
    })
    .eq('id', reviewId)

  if (updateError) return { error: 'Failed to send message' }

  revalidatePath(`/listings/${review.listing_id}`)
  revalidatePath('/dashboard/admin/reviews')
  
  return { error: null, message: newMessage }
}
