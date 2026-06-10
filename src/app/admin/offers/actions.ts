'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteOffer(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get before deleting
  const { data: offer } = await supabase.from('listing_best_offers').select('*, listing:listings(title)').eq('id', id).single()

  const { error } = await supabase.from('listing_best_offers').delete().eq('id', id)

  if (error) {
    console.error('Error deleting offer:', error)
    return { error: error.message }
  }

  if (offer) {
    await supabase.rpc('create_audit_log', {
      p_action: 'best_offer.delete',
      p_entity_type: 'best_offer',
      p_entity_id: id,
      p_entity_name: `Offer for ${(offer.listing as any)?.title || 'Listing'}`,
      p_old_data: offer,
      p_notes: 'Deleted via admin panel'
    })
  }

  revalidatePath('/admin/offers')
  return { success: true }
}

export async function updateOfferStatus(id: string, status: 'approved' | 'rejected') {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: offer } = await supabase.from('listing_best_offers').select('*, listing:listings(title)').eq('id', id).single()

  const { error } = await supabase.from('listing_best_offers').update({ status }).eq('id', id)

  if (error) return { error: error.message }

  if (offer) {
    await supabase.rpc('create_audit_log', {
      p_action: `best_offer.${status}`,
      p_entity_type: 'best_offer',
      p_entity_id: id,
      p_entity_name: `Offer for ${(offer.listing as any)?.title || 'Listing'}`,
      p_new_data: { status },
      p_notes: `Status updated to ${status} via admin panel`
    })
  }

  revalidatePath('/admin/offers')
  return { success: true }
}
