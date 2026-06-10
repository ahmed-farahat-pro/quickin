'use server'

import { getListings } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { ListingWithHost } from '@/types'

import { LISTINGS_PER_PAGE } from '@/lib/constants'
import { revalidatePath } from 'next/cache'

export async function fetchMoreListings(
  page: number,
  params: {
    category?: string
    location?: string
    checkIn?: string
    checkOut?: string
    guests?: string
    priceMin?: string
    priceMax?: string
    attributes?: string
    propertyType?: string
    bestOffer?: string
    view?: string
    sortBy?: string
    // Resolved geo coords — passed down when a destination pill is selected
    geoLat?: number
    geoLng?: number
    geoRadiusKm?: number
    country?: string
    includeSurrounding?: boolean
    locale?: string
  }
): Promise<ListingWithHost[]> {
  const supabase = await createClient()
  const user = supabase ? (await supabase.auth.getUser()).data.user : null

  const category = params.category
  const location = params.location
  const checkIn = params.checkIn
  const checkOut = params.checkOut
  const guests = params.guests ? parseInt(params.guests) : undefined
  const priceMin = params.priceMin ? parseInt(params.priceMin) : undefined
  const priceMax = params.priceMax ? parseInt(params.priceMax) : undefined
  const attributes = params.attributes ? params.attributes.split(',') : undefined
  const offset = (page - 1) * LISTINGS_PER_PAGE

  // If geo coords were passed (destination pill was selected), use geo search.
  // Otherwise fall back to plain text search — same as the initial page load.
  const geoSearch = (params.geoLat != null && params.geoLng != null && params.geoRadiusKm != null)
    ? { lat: params.geoLat, lng: params.geoLng, radiusKm: params.geoRadiusKm }
    : undefined

  return getListings({
    category,
    location: geoSearch ? undefined : location, // text search only when no geo
    checkIn,
    checkOut,
    guests,
    priceMin,
    priceMax,
    attributes,
    propertyType: params.propertyType ? params.propertyType.split(',') : undefined,
    limit: LISTINGS_PER_PAGE,
    offset,
    bestOffer: params.bestOffer === 'true',
    geoSearch,
    country: params.country,
    includeSurrounding: params.includeSurrounding,
    locale: params.locale,
    sortBy: params.sortBy,
    userId: user?.id,
  })
}

/**
 * Unpublishes a listing if it doesn't have active or requested bookings.
 */
export async function unpublishListing(listingId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 1. Fetch listing to check ownership and get title for logs
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('user_id, title')
    .eq('id', listingId)
    .single()

  if (listingError || !listing) return { error: 'Listing not found' }

  // 2. Check permissions: host of the listing OR staff
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()
  
  const isStaff = !!staffProfile
  const isOwner = listing.user_id === user.id

  if (!isOwner && !isStaff) {
    return { error: 'Not authorized' }
  }

  // 3. Check for active/pending/requested bookings
  // statuses that block unpublishing: pending, confirmed, active, stalled
  const { count, error: bookingError } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .in('status', ['pending', 'confirmed', 'active', 'stalled'])

  if (bookingError) {
    console.error('Error checking bookings:', bookingError)
    return { error: 'Failed to check bookings' }
  }

  if (count && count > 0) {
    if (isStaff) {
      return { 
        error: 'Cannot unpublish: This listing has current or requested bookings.',
        details: 'As an admin, you must first resolve these bookings (e.g., force-cancel, reject requested, or wait for completion) before unpublishing.',
        hasBookings: true
      }
    }
    return { 
      error: 'Cannot unpublish: You have current or requested bookings for this listing.',
      hasBookings: true
    }
  }

  // 4. Update listing
  const { error: updateError } = await supabase
    .from('listings')
    .update({ is_published: false })
    .eq('id', listingId)

  if (updateError) {
    console.error('Error unpublishing listing:', updateError)
    return { error: updateError.message }
  }

  // 5. Audit Log
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    actor_type: isStaff ? (staffProfile.role === 'admin' ? 'admin' : 'staff') : 'user',
    action: 'listing.unpublish',
    action_category: 'content',
    entity_type: 'listing',
    entity_id: listingId,
    entity_name: listing.title,
    new_data: { is_published: false }
  })

  // Revalidate both paths
  revalidatePath('/dashboard/listings')
  revalidatePath('/admin/listings')
  revalidatePath(`/listings/${listingId}`)

  return { success: true }
}

/**
 * Publishes a previously unpublished listing.
 */
export async function publishListing(listingId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 1. Fetch listing
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('user_id, title')
    .eq('id', listingId)
    .single()

  if (listingError || !listing) return { error: 'Listing not found' }

  // 2. Check permissions
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()
  
  const isStaff = !!staffProfile
  const isOwner = listing.user_id === user.id

  if (!isOwner && !isStaff) {
    return { error: 'Not authorized' }
  }

  const { error: updateError } = await supabase
    .from('listings')
    .update({ is_published: true })
    .eq('id', listingId)

  if (updateError) return { error: updateError.message }

  // Audit Log
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    actor_type: isStaff ? (staffProfile.role === 'admin' ? 'admin' : 'staff') : 'user',
    action: 'listing.publish',
    action_category: 'content',
    entity_type: 'listing',
    entity_id: listingId,
    entity_name: listing.title,
    new_data: { is_published: true }
  })

  revalidatePath('/dashboard/listings')
  revalidatePath('/admin/listings')
  revalidatePath(`/listings/${listingId}`)

  return { success: true }
}

