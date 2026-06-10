'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { MAX_OFFER_DAYS } from '@/lib/constants'

export async function requestBestOffer(listingId: string, startDate: Date, endDate: Date, offerPrice: number) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured', success: false }

  // 1. Verify Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized', success: false }
  }

  // 2. Verify Ownership
  const { data: listing, error: fetchError } = await supabase
    .from('listings')
    .select('user_id')
    .eq('id', listingId)
    .single()

  if (fetchError || !listing) {
    return { error: 'Listing not found', success: false }
  }

  if (listing.user_id !== user.id) {
    return { error: 'You do not own this listing', success: false }
  }

  // 3. Validation: Max duration 1 month
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  if (diffDays > MAX_OFFER_DAYS) {
    return { error: `Best offers cannot exceed ${MAX_OFFER_DAYS} days`, success: false }
  }
  
  if (diffDays < 1) {
    return { error: 'Best offers must be at least 1 day long', success: false }
  }

  const startIso = startDate.toISOString()
  const endIso = endDate.toISOString()

  // 4. Validation: Check for Overlaps with existing ACTIVE or REQUESTED offers
  // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
  const { data: existingOffers, error: overlapError } = await supabase
    .from('listing_best_offers')
    .select('id, start_date, end_date')
    .eq('listing_id', listingId)
    .in('status', ['requested', 'approved']) // Only check against active/pending offers
    .lte('start_date', endIso) // Existing start <= New end
    .gte('end_date', startIso) // Existing end >= New start

  if (overlapError) {
    console.error('Error checking overlaps:', overlapError)
    return { error: 'Failed to validate dates', success: false }
  }

  if (existingOffers && existingOffers.length > 0) {
     return { error: 'There is already an active or pending offer during these dates.', success: false }
  }

  // 5. Insert new request
  const { error: insertError } = await supabase
    .from('listing_best_offers')
    .insert({
        listing_id: listingId,
        start_date: startIso,
        end_date: endIso,
        status: 'requested',
        offer_price: offerPrice
    })

  if (insertError) {
    console.error('Error requesting best offer:', insertError)
    return { error: 'Failed to request best offer', success: false }
  }

  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/hosting/listings')
  revalidatePath(`/dashboard/listings/${listingId}/manage`)
  return { success: true }
}

export async function approveBestOffer(offerId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured', success: false }

  // 1. Verify Authentication & Role
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized', success: false }
  }

  const { data: staffProfile, error: staffError } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (staffError || !staffProfile || !['admin', 'staff', 'super_admin'].includes(staffProfile.role)) {
    return { error: 'Permission denied', success: false }
  }

  // 2. Fetch Offer to get Listing ID, dates, and price
  const { data: offer, error: fetchError } = await supabase
    .from('listing_best_offers')
    .select('listing_id, start_date, end_date, offer_price')
    .eq('id', offerId)
    .single()

  if (fetchError || !offer) {
    return { error: 'Offer not found', success: false }
  }

  // 3. Update Offer Status
  const { error: updateError } = await supabase
    .from('listing_best_offers')
    .update({ 
      status: 'approved',
      updated_at: new Date().toISOString()
    })
    .eq('id', offerId)

  if (updateError) {
    console.error('Error approving best offer:', updateError)
    return { error: 'Failed to approve best offer', success: false }
  }

  // 4. Auto-apply offer price to each day in the range
  const offerPrice = offer.offer_price ? Number(offer.offer_price) : null
  if (offerPrice !== null && offerPrice > 0) {
    const startDate = new Date(offer.start_date)
    const endDate = new Date(offer.end_date)
    const days: { listing_id: string; date: string; is_available: boolean; price_override: number }[] = []

    const current = new Date(startDate)
    while (current <= endDate) {
      days.push({
        listing_id: offer.listing_id,
        date: current.toISOString().split('T')[0],
        is_available: true,
        price_override: offerPrice
      })
      current.setDate(current.getDate() + 1)
    }

    if (days.length > 0) {
      const { error: upsertError } = await supabase
        .from('listing_availability')
        .upsert(days, {
          onConflict: 'listing_id,date',
          ignoreDuplicates: false
        })

      if (upsertError) {
        console.error('Error applying offer prices:', upsertError)
        // Don't fail the approval — the status is already updated
      }
    }
  }

  revalidatePath('/admin/approvals/best-offers')
  revalidatePath(`/listings/${offer.listing_id}`)
  revalidatePath(`/dashboard/listings/${offer.listing_id}/manage`)
  return { success: true }
}

export async function rejectBestOffer(offerId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured', success: false }

  // 1. Verify Authentication & Role
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized', success: false }
  }

  const { data: staffProfile, error: staffError } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (staffError || !staffProfile || !['admin', 'staff', 'super_admin'].includes(staffProfile.role)) {
    return { error: 'Permission denied', success: false }
  }

  // 2. Update Offer Status
  const { error: updateError } = await supabase
    .from('listing_best_offers')
    .update({ 
      status: 'rejected',
      updated_at: new Date().toISOString()
    })
    .eq('id', offerId)

  if (updateError) {
    console.error('Error rejecting best offer:', updateError)
    return { error: 'Failed to reject best offer', success: false }
  }
  
  // Fetch listing ID for revalidation
  const { data: offer } = await supabase
    .from('listing_best_offers')
    .select('listing_id')
    .eq('id', offerId)
    .single()

  if (offer) {
      // If we rejected the *active* one, verify if we need to revert listing status
      // For now, simpler to just revalidate
      revalidatePath(`/listings/${offer.listing_id}`)
  }

  revalidatePath('/admin/approvals/best-offers')
  if (offer) {
    revalidatePath(`/dashboard/listings/${offer.listing_id}/manage`)
  }
  return { success: true }
}

/**
 * Allows a host to cancel their own pending (not yet approved) offer request.
 */
export async function cancelBestOffer(offerId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured', success: false }

  // 1. Verify Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized', success: false }
  }

  // 2. Fetch offer and verify ownership via listing
  const { data: offer, error: fetchError } = await supabase
    .from('listing_best_offers')
    .select('id, status, listing_id, listings!inner(user_id)')
    .eq('id', offerId)
    .single()

  if (fetchError || !offer) {
    return { error: 'Offer not found', success: false }
  }

  // Verify the host owns the listing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listing = (offer as any).listings
  if (listing?.user_id !== user.id) {
    return { error: 'You do not own this listing', success: false }
  }

  // 3. Only allow cancellation of 'requested' offers
  if (offer.status !== 'requested') {
    return { error: 'Only pending requests can be cancelled', success: false }
  }

  // 4. Update status to 'cancelled'
  const { error: updateError } = await supabase
    .from('listing_best_offers')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', offerId)

  if (updateError) {
    console.error('Error cancelling best offer:', updateError)
    return { error: 'Failed to cancel offer', success: false }
  }

  // 5. Revalidate paths
  revalidatePath(`/listings/${offer.listing_id}`)
  revalidatePath(`/dashboard/listings/${offer.listing_id}/manage`)
  revalidatePath('/dashboard/listings')
  return { success: true }
}
