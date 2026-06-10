'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateHostListingSettings(listingId: string, data: any) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 1. Verify ownership and fetch full old data for audit logs
  const { data: existingListing, error: checkError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (checkError || !existingListing || existingListing.user_id !== user.id) {
    return { error: 'Not authorized or listing not found' }
  }

  // 2. Filter only allowed fields (Server-side guard)
  // Allowed: description, description_ar (via translations), location, google_maps_link, 
  // max_guests, beds, price_per_night, cleaning_fee, currency, min_nights
  const allowedData: any = {}
  
  if (data.description !== undefined) allowedData.description = data.description
  if (data.location !== undefined) allowedData.location = data.location
  if (data.google_maps_link !== undefined) allowedData.google_maps_link = data.google_maps_link
  if (data.max_guests !== undefined) allowedData.max_guests = data.max_guests
  if (data.beds !== undefined) allowedData.beds = data.beds
  if (data.price_per_night !== undefined) allowedData.price_per_night = data.price_per_night
  if (data.cleaning_fee !== undefined) allowedData.cleaning_fee = data.cleaning_fee
  if (data.currency !== undefined) allowedData.currency = data.currency
  if (data.min_nights !== undefined) allowedData.min_nights = data.min_nights

  // Handle Arabic description in translations
  if (data.description_ar !== undefined) {
    const currentTranslations = existingListing.translations || {}
    allowedData.translations = {
      ...currentTranslations,
      ar: {
        ...(currentTranslations.ar || {}),
        description: data.description_ar
      }
    }
  }

  // Trigger admin review workflow
  allowedData.is_published = false
  // review_status added in migration 061
  allowedData.review_status = 'pending_review'

  const { error: updateError } = await supabase
    .from('listings')
    .update(allowedData)
    .eq('id', listingId)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('Error updating listing:', updateError)
    return { error: updateError.message }
  }

  // 3. Update Lifestyle categories if provided
  if (data.lifestyle_category_ids !== undefined) {
    await supabase.from('listing_lifestyles').delete().eq('listing_id', listingId)
    if (data.lifestyle_category_ids.length > 0) {
      const lsInserts = data.lifestyle_category_ids.map((cid: string, idx: number) => ({
        listing_id: listingId,
        lifestyle_category_id: cid,
        is_primary: idx === 0
      }))
      await supabase.from('listing_lifestyles').insert(lsInserts)
    }
  }

  // 4. Update Images if provided
  if (data.images !== undefined) {
    await supabase.from('listing_images').delete().eq('listing_id', listingId)
    if (data.images.length > 0) {
      const imageInserts = data.images.map((img: any, index: number) => ({
        listing_id: listingId,
        url: img.url,
        category: img.category || 'other',
        order: index
      }))
      await supabase.from('listing_images').insert(imageInserts)
    }
  }

  revalidatePath(`/dashboard/listings/${listingId}/manage`)
  return { success: true }
}
