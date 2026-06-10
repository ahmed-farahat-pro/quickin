'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteReview(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: review } = await supabase.from('reviews').select('*, listing:listings(title), reviewer:profiles!reviews_user_id_fkey(full_name)').eq('id', id).single()

  const { error } = await supabase.from('reviews').delete().eq('id', id)

  if (error) {
    console.error('Error deleting review:', error)
    return { error: error.message }
  }

  if (review) {
    await supabase.rpc('create_audit_log', {
      p_action: 'review.delete',
      p_entity_type: 'review',
      p_entity_id: id,
      p_entity_name: `Review for ${(review.listing as any)?.title}`,
      p_old_data: review,
      p_notes: 'Deleted via admin panel'
    })
  }

  revalidatePath('/admin/reviews')
  return { success: true }
}

export async function toggleReviewVisibility(id: string, is_hidden: boolean) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: review } = await supabase.from('reviews').select('*, listing:listings(title)').eq('id', id).single()

  const { error } = await supabase.from('reviews').update({ is_hidden }).eq('id', id)

  if (error) return { error: error.message }

  if (review) {
    await supabase.rpc('create_audit_log', {
      p_action: is_hidden ? 'review.hide' : 'review.unhide',
      p_entity_type: 'review',
      p_entity_id: id,
      p_entity_name: `Review for ${(review.listing as any)?.title}`,
      p_new_data: { is_hidden },
      p_notes: `Visibility toggled via admin panel`
    })
  }

  revalidatePath('/admin/reviews')
  return { success: true }
}
