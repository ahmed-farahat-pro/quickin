// =============================================================================

import { cache } from 'react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ListingWithHost, Category, ReviewWithUser, FilterableAttribute } from '@/types'
import { LISTINGS_PER_PAGE } from '@/lib/constants'

/**
 * Options for fetching listings with advanced filtering
 */
interface GetListingsOptions {
  // Basic filters
  category?: string    // Filter by category slug
  location?: string    // Search by location/city/country
  limit?: number       // Max results (default LISTINGS_PER_PAGE)
  offset?: number      // Pagination offset
  // Advanced filters
  checkIn?: string     // Check-in date (YYYY-MM-DD)
  checkOut?: string    // Check-out date (YYYY-MM-DD)
  guests?: number      // Minimum guest capacity
  priceMin?: number    // Minimum price per night
  priceMax?: number    // Maximum price per night
  attributes?: string[] // Attribute codes (listing must have ALL)
  // New filters for search destinations
  geoSearch?: { lat: number, lng: number, radiusKm: number }
  specificIds?: string[]
  country?: string // Existing filter, but explicit here
  includeSurrounding?: boolean // If false, strictly enforces country filter even with geo search
  propertyType?: string[] // Filter by property type slugs
  bestOffer?: boolean // Filter for active Best Offers
  locale?: string // Localized output language code
  sortBy?: string // Sorting parameter (e.g., 'recommended', 'price_asc', 'price_desc', 'rating', 'newest', 'distance')
  userId?: string // User ID for personalized recommendations
}

/**
 * Fetches listings with optional filtering and pagination.
 * Uses a single database RPC call (search_listings) for all filtering,
 * replacing 7-11 sequential queries with one roundtrip.
 */
export async function getListings(options?: GetListingsOptions): Promise<ListingWithHost[]> {
  const supabase = await createClient()
  if (!supabase) {
    return []
  }

  const limit = options?.limit ?? LISTINGS_PER_PAGE
  const offset = options?.offset ?? 0

  const { data, error } = await supabase.rpc('search_listings', {
    p_location: (!options?.geoSearch && !options?.specificIds) ? (options?.location ?? null) : null,
    p_geo_lat: options?.geoSearch?.lat ?? null,
    p_geo_lng: options?.geoSearch?.lng ?? null,
    p_geo_radius_km: options?.geoSearch?.radiusKm ?? null,
    p_specific_ids: options?.specificIds ?? null,
    p_country: options?.country ?? null,
    p_include_surrounding: options?.includeSurrounding ?? true,
    p_category_slug: options?.category ?? null,
    p_property_type_slugs: options?.propertyType ?? null,
    p_guests: options?.guests ?? null,
    p_price_min: options?.priceMin ?? null,
    p_price_max: options?.priceMax ?? null,
    p_check_in: options?.checkIn ?? null,
    p_check_out: options?.checkOut ?? null,
    p_attribute_codes: options?.attributes ?? null,
    p_best_offer: options?.bestOffer ?? false,
    p_limit: limit,
    p_offset: offset,
    p_locale: options?.locale ?? 'en',
    p_sort_by: options?.sortBy ?? 'recommended',
    p_user_id: options?.userId ?? null,
  })

  if (error) {
    console.error('Error fetching listings:', error)
    throw new Error('Failed to fetch listings')
  }

  if (!data || data.length === 0) return []

  // Map RPC results to ListingWithHost shape
  return data.map((row: any) => {
    const images = row.images_json
      ? (row.images_json as any[]).map((i: any) => i.url)
      : []

    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      price_per_night: row.price_per_night,
      location: row.location,
      city: row.city,
      state: row.state,
      country: row.country,
      max_guests: row.max_guests,
      bedrooms: row.bedrooms,
      beds: row.beds,
      bathrooms: row.bathrooms,
      property_type_id: row.property_type_id,

      is_guest_favorite: row.is_guest_favorite,
      is_published: row.is_published,
      cleaning_fee: row.cleaning_fee,
      currency: row.currency,
      cancellation_policy: row.cancellation_policy,
      listing_code: row.listing_code,
      created_at: row.created_at,
      updated_at: row.updated_at,
      images,
      host: row.host_json ?? {},
      property_type: row.property_type_json ?? null,
      listing_lifestyles: row.lifestyles_json ?? [],
      rating: Number(row.avg_rating) || 4.5,
      review_count: Number(row.review_count) || 0,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      best_offer_price: row.best_offer_price ? Number(row.best_offer_price) : null,
      display_price: row.display_price ? Number(row.display_price) : undefined,
      total_price: row.total_price ? Number(row.total_price) : null,
      num_nights: row.num_nights ? Number(row.num_nights) : null,
      // total_count is available on every row for pagination
      _total_count: Number(row.total_count) || 0,
    }
  }) as ListingWithHost[]
}

/**
 * Get total count of listings (for pagination).
 * When called after getListings(), prefer extracting _total_count from the results
 * instead of calling this function (which makes a separate DB query).
 */
export async function getListingsCount(options?: { category?: string; location?: string }): Promise<number> {
  const supabase = await createClient()
  if (!supabase) return 0

  let query = supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)

  // Filter by category slug
  if (options?.category) {
    const { data: categoryData } = await supabase
      .from('lifestyle_categories')
      .select('id')
      .eq('slug', options.category)
      .single()

    if (categoryData) {
      const { data: listingIds } = await supabase
        .from('listing_lifestyles')
        .select('listing_id')
        .eq('lifestyle_category_id', categoryData.id)

      if (listingIds && listingIds.length > 0) {
        query = query.in('id', listingIds.map(l => l.listing_id))
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000')
      }
    }
  }

  // Location filter
  if (options?.location) {
    const searchTerm = `%${options.location}%`
    query = query.or(`title.ilike.${searchTerm},location.ilike.${searchTerm}`)
  }

  const { count, error } = await query

  if (error) {
    console.error('Error counting listings:', error)
    return 0
  }

  return count || 0
}

/**
 * Fetch active search destinations with resolved lat/lng coordinates.
 * Uses get_active_destinations_with_coords() RPC which calls ST_X/ST_Y
 * on the PostGIS geography column — avoiding WKB hex parsing client-side.
 */
export async function getDestinations(locale: string = 'en') {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase.rpc('get_active_destinations_with_coords', {
    p_locale: locale,
  })

  if (error) {
    console.error('Error fetching destinations:', error)
    return []
  }

  return data || []
}

/**
 * Fetches a single listing by ID
 * @param id - Listing UUID
 * @param locale - Requested locale language code
 * @returns Listing with host info or null
 */
export async function getListingById(id: string, locale: string = 'en'): Promise<ListingWithHost | null> {
  const supabase = await createClient()
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      country:countries(name, translations),
      state:states(name, translations),
      city:cities(name, translations),
      host:profiles!listings_user_id_fkey(*),
      listing_lifestyles(lifestyle_category:lifestyle_categories(*)),
      property_type:property_types(*),
      listing_images(*, category_details:image_categories(*))
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching listing:', JSON.stringify(error, null, 2))
    return null
  }

  // Check if host is staff using Admin Client to bypass RLS
  const adminSupabase = await createAdminClient()
  let isStaffHostedExplicit = false
  if (adminSupabase) {
    const { data: staffData } = await adminSupabase
      .from('staff_profiles')
      .select('role')
      .eq('id', data.user_id)
      .maybeSingle()
    isStaffHostedExplicit = !!staffData
  }

  // Get rating
  // Get rating
  const { data: ratingData } = await supabase
    .rpc('get_listing_rating', { listing_uuid: id })

  const { data: countData } = await supabase
    .rpc('get_listing_review_count', { listing_uuid: id })

  // Map listing_images to simple images array for backward compatibility
  const images = data.listing_images
    ? data.listing_images.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)).map((i: any) => i.url)
    : []

  // Helper for generic translations object
  const getLocalizedValue = (obj: any, field: string): string | null => {
    if (!obj) return null
    if (locale !== 'en' && obj.translations) {
      const trans = obj.translations as Record<string, any>
      const localized = trans[locale]
      if (localized) {
        if (typeof localized === 'object' && localized !== null) {
          // Nested structure: { "ar": { "title": "...", "description": "..." } }
          const val = localized[field]
          if (val) return val
        } else if (typeof localized === 'string') {
          // Flat structure: { "ar": "..." } - usually for 'name' or 'label'
          // Treat flat string as the requested field if it's a common name field
          if (field === 'name' || field === 'label' || field === 'title') {
            return localized
          }
        }
      }
    }
    return obj[field] || null
  }

  const hostStaff = (data.host as any)?.staff
  // Try multiple ways to identify staff: explicit admin query, nested join result, or name fallback
  const isStaffHosted = isStaffHostedExplicit || 
                        (Array.isArray(hostStaff) ? hostStaff.length > 0 : !!hostStaff) ||
                        data.host?.full_name?.toLowerCase().includes('admin') ||
                        data.host?.email?.toLowerCase().includes('admin')

  return {
    ...data,
    title: getLocalizedValue(data, 'title') || data.title,
    description: getLocalizedValue(data, 'description') || data.description,
    country: getLocalizedValue(data.country, 'name'),
    state: getLocalizedValue(data.state, 'name'),
    city: getLocalizedValue(data.city, 'name'),
    is_staff_hosted: isStaffHosted,
    property_type: data.property_type ? {
      ...data.property_type,
      name: getLocalizedValue(data.property_type, 'name') || data.property_type.name
    } : null,
    listing_lifestyles: data.listing_lifestyles?.map((ls: any) => ({
      ...ls,
      lifestyle_category: ls.lifestyle_category ? {
        ...ls.lifestyle_category,
        name: getLocalizedValue(ls.lifestyle_category, 'name') || ls.lifestyle_category.name
      } : ls.lifestyle_category
    })) || [],
    images,
    rating: ratingData || 4.5,
    review_count: countData || 0,
  } as ListingWithHost
}


/**
 * Fetches a single listing by its 4-character code (case-insensitive)
 * @param code - 4-character listing code
 * @returns Listing ID if found, null otherwise
 */
export async function getListingByCode(code: string): Promise<{ id: string } | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('listings')
    .select('id')
    .ilike('listing_code', code)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Fetches all categories
 * @returns Array of categories
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient()
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching categories:', error)
    return []
  }

  return data || []
}

export async function searchListings(query: string): Promise<ListingWithHost[]> {
  return getListings({ location: query, limit: 20 })
}

/**
 * Fetch reviews for a listing
 * @param listingId - Listing UUID
 * @returns Array of reviews with user info
 */
export async function getReviews(listingId: string): Promise<ReviewWithUser[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      user:profiles(*)
    `)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching reviews:', error)
    return []
  }

  return (data || []) as ReviewWithUser[]
}

/**
 * Check if current user can review a listing
 * Requires a completed booking for that listing
 * @param listingId - Listing UUID
 * @returns boolean
 */
export async function getReviewEligibility(listingId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { count, error } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .eq('user_id', user.id)
    .eq('status', 'completed')

  if (error) {
    console.error('Error checking review eligibility:', error)
    return false
  }

  return (count || 0) > 0
}

/**
 * Check if user has existing pending or confirmed booking request for a listing
 * @param listingId - Listing UUID
 * @param userId - User UUID (optional, uses current user if not provided)
 * @returns True if user already has an active booking request
 */
export async function getExistingBookingStatus(listingId: string, userId?: string): Promise<string | null> {
  const supabase = await createClient()
  if (!supabase) return null

  // Get current user if not provided
  let actualUserId = userId
  if (!actualUserId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    actualUserId = user.id
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('status')
    .eq('listing_id', listingId)
    .eq('user_id', actualUserId)
    .in('status', ['pending', 'confirmed', 'active'])
    .limit(1)
    .single()

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking existing booking:', error)
    }
    return null
  }

  return data.status
}

/**
 * Fetch blocked dates, custom price dates, and price adjustments for a listing in an optimized way
 * @param listingId - Listing UUID
 * @returns Object with blocked dates, custom price dates, and price adjustment dates
 */
export async function getListingAvailabilityAndAdjustments(listingId: string): Promise<{
  blockedDates: Date[]
  customPriceDates: Date[]
  priceAdjustments: {
    customPriceDates: Date[]
    weekendAdjustedDates: Date[]
    dateRangeAdjustedDates: Date[]
  }
}> {
  const supabase = await createClient()
  if (!supabase) {
    return {
      blockedDates: [],
      customPriceDates: [],
      priceAdjustments: { customPriceDates: [], weekendAdjustedDates: [], dateRangeAdjustedDates: [] }
    }
  }

  // Use Promise.all to fetch availability (blocked dates and custom prices) and adjustments concurrently
  const [availabilityResult, adjustmentsResult] = await Promise.all([
    supabase
      .from('listing_availability')
      .select('date, is_available, price_override')
      .eq('listing_id', listingId)
      .or('is_available.eq.false,price_override.not.is.null'),
    supabase
      .from('listing_price_adjustments')
      .select('*')
      .eq('listing_id', listingId)
      .eq('is_active', true)
  ])

  const availabilityData = availabilityResult.data || []
  const adjustmentsData = adjustmentsResult.data || []

  const blockedDates: Date[] = []
  const customPriceDates: Date[] = []

  for (const item of availabilityData) {
    if (item.is_available === false) {
      blockedDates.push(new Date(item.date))
    }
    if (item.price_override !== null) {
      customPriceDates.push(new Date(item.date))
    }
  }

  const weekendAdjustedDates: Date[] = []
  const dateRangeAdjustedDates: Date[] = []

  // Check for weekend adjustments (uses applies_to_days array like ['friday', 'saturday'])
  const weekendDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  // Optimize: Collect all applicable days first to avoid nested 180-day loops
  const applicableDays = new Set<string>()
  for (const adj of adjustmentsData) {
    if (adj.applies_to_days && adj.applies_to_days.length > 0) {
      for (const day of adj.applies_to_days) {
        applicableDays.add(day.toLowerCase())
      }
    }
  }

  // Iterate 180 days once if we have any recurring adjustments
  if (applicableDays.size > 0) {
    const today = new Date()
    for (let i = 0; i < 180; i++) { // Next 6 months
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      const dayName = weekendDays[date.getDay()].toLowerCase()

      if (applicableDays.has(dayName)) {
        weekendAdjustedDates.push(date)
      }
    }
  }

  for (const adj of adjustmentsData) {
    // Check for date range adjustments (holidays, seasons)
    if (adj.start_date && adj.end_date) {
      const start = new Date(adj.start_date)
      const end = new Date(adj.end_date)
      const current = new Date(start)
      while (current <= end) {
        dateRangeAdjustedDates.push(new Date(current))
        current.setDate(current.getDate() + 1)
      }
    }

    // Check for specific_dates array
    if (adj.specific_dates && adj.specific_dates.length > 0) {
      for (const dateStr of adj.specific_dates) {
        dateRangeAdjustedDates.push(new Date(dateStr))
      }
    }
  }

  return {
    blockedDates,
    customPriceDates,
    priceAdjustments: { customPriceDates, weekendAdjustedDates, dateRangeAdjustedDates }
  }
}
/**
 * Calculate booking price for a date range, factoring in price adjustments
 * @param listingId - Listing UUID
 * @param basePrice - Base price per night
 * @param checkIn - Check-in date string (YYYY-MM-DD)
 * @param checkOut - Check-out date string (YYYY-MM-DD)
 * @returns Object with subtotal, breakdown per day, and any adjustments applied
 */
export async function calculateBookingPrice(
  listingId: string,
  basePrice: number,
  checkIn: string,
  checkOut: string
): Promise<{
  subtotal: number
  nights: number
  pricePerNight: { date: string; price: number; adjustmentName?: string }[]
}> {
  const supabase = await createClient()
  if (!supabase) {
    // Fallback to base price calculation
    const nights = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
    )
    return {
      subtotal: nights * basePrice,
      nights,
      pricePerNight: []
    }
  }

  // Get date range
  const startDate = new Date(checkIn)
  const endDate = new Date(checkOut)
  const dates: string[] = []
  const current = new Date(startDate)

  while (current < endDate) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  // Fetch any custom prices for specific dates
  const { data: customPrices } = await supabase
    .from('listing_availability')
    .select('date, price_override')
    .eq('listing_id', listingId)
    .in('date', dates)
    .not('price_override', 'is', null)

  // Fetch any active price adjustments for this listing
  const { data: adjustments } = await supabase
    .from('listing_price_adjustments')
    .select('*')
    .eq('listing_id', listingId)
    .eq('is_active', true)

  // Fetch approved best offers that overlap with the date range (highest priority)
  const { data: bestOffers } = await supabase
    .from('listing_best_offers')
    .select('start_date, end_date, offer_price')
    .eq('listing_id', listingId)
    .eq('status', 'approved')
    .not('offer_price', 'is', null)
    .lte('start_date', checkOut)
    .gte('end_date', checkIn)

  // Create a map of offer prices by date (highest priority)
  const offerPriceMap = new Map<string, number>()
  for (const offer of bestOffers || []) {
    if (offer.offer_price) {
      // Extract just the date part (YYYY-MM-DD) to avoid timezone issues
      const offerStartStr = offer.start_date.split('T')[0].split(' ')[0]
      const offerEndStr = offer.end_date.split('T')[0].split(' ')[0]
      for (const dateStr of dates) {
        if (dateStr >= offerStartStr && dateStr <= offerEndStr) {
          offerPriceMap.set(dateStr, Number(offer.offer_price))
        }
      }
    }
  }

  // Create a map of custom prices by date
  const customPriceMap = new Map<string, number>()
  for (const cp of customPrices || []) {
    if (cp.price_override) {
      customPriceMap.set(cp.date, cp.price_override)
    }
  }

  // Calculate price for each night
  const pricePerNight: { date: string; price: number; adjustmentName?: string }[] = []
  let subtotal = 0

  for (const dateStr of dates) {
    const date = new Date(dateStr)
    let price = basePrice
    let adjustmentName: string | undefined

    // Check for best offer price first (highest priority - overrides everything)
    if (offerPriceMap.has(dateStr)) {
      price = offerPriceMap.get(dateStr)!
      adjustmentName = 'Best Offer'
    } else if (customPriceMap.has(dateStr)) {
      // Check for custom price (second priority)
      price = customPriceMap.get(dateStr)!
      adjustmentName = 'Custom price'
    } else {
      // Check for adjustments
      const weekendDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const dayName = weekendDays[date.getDay()].toLowerCase()

      for (const adj of adjustments || []) {
        let applies = false

        // Check applies_to_days for recurring day-based adjustments (weekends)
        if (adj.applies_to_days && adj.applies_to_days.length > 0) {
          if (adj.applies_to_days.includes(dayName)) {
            applies = true
          }
        }

        // Check for date range adjustments (holidays, seasons)
        if (adj.start_date && adj.end_date) {
          const start = new Date(adj.start_date)
          const end = new Date(adj.end_date)
          if (date >= start && date <= end) {
            applies = true
          }
        }

        // Check for specific_dates
        if (adj.specific_dates && adj.specific_dates.includes(dateStr)) {
          applies = true
        }

        if (applies) {
          // adjustment_value is the change amount (percentage or fixed)
          // adjustment_type is 'percentage' or 'fixed'
          if (adj.adjustment_type === 'percentage') {
            price = Math.round(basePrice * (1 + adj.adjustment_value / 100))
          } else if (adj.adjustment_type === 'fixed') {
            price = basePrice + adj.adjustment_value
          }
          adjustmentName = adj.name
          break // Use first matching adjustment
        }
      }
    }

    pricePerNight.push({ date: dateStr, price, adjustmentName })
    subtotal += price
  }

  return {
    subtotal,
    nights: dates.length,
    pricePerNight
  }
}

/**
 * Fetch days that are already booked for a listing
 * Uses RPC to bypass RLS safely
 */
export async function getListingBookedDates(listingId: string) {
  const supabase = await createClient()
  if (!supabase) return []

  // Use secure RPC to get booked dates (bypassing RLS via SECURITY DEFINER function)
  const { data, error } = await supabase.rpc('get_listing_booked_dates', {
    listing_uuid: listingId
  })

  if (error) {
    console.error('Error fetching booked dates via RPC:', error)
    return []
  }

  if (!data) return []

  const bookedDates: Date[] = []

  // Data comes back as { check_in: string, check_out: string }[]
  for (const booking of data) {
    const start = new Date(booking.check_in)
    const end = new Date(booking.check_out)

    // Create array of dates in range [start, end)
    const current = new Date(start)
    while (current < end) {
      bookedDates.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
  }

  return bookedDates
}


/**
 * Fetch filterable attributes (amenities)
 */
export const getAttributes = cache(async (): Promise<FilterableAttribute[]> => {
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('attributes')
    .select('id, code, label, icon_class')
    .eq('is_approved', true)
    .eq('is_enabled', true)
    .eq('is_filterable', true)
    .order('label')

  return (data || []) as FilterableAttribute[]
})

/**
 * Fetch all property types
 */
export const getPropertyTypes = cache(async (): Promise<{ id: string, name: string, slug: string, type: 'home' | 'service' }[]> => {
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('property_types')
    .select('id, name, slug, type')
    .order('name')

  return (data || []) as { id: string, name: string, slug: string, type: 'home' | 'service' }[]
})
