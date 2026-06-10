'use server'

import { calculateBookingPrice } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Date format validation (YYYY-MM-DD)
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function getCalculatedPrice(
  listingId: string,
  _basePrice: number, // Ignored for security - we fetch from DB
  checkIn: string,
  checkOut: string
) {
  try {
    // Validate inputs
    if (!UUID_REGEX.test(listingId)) {
      throw new Error('Invalid listing ID format')
    }
    if (!DATE_REGEX.test(checkIn) || !DATE_REGEX.test(checkOut)) {
      throw new Error('Invalid date format')
    }

    // Fetch actual price from database (don't trust client)
    const supabase = await createClient()
    if (!supabase) {
      throw new Error('Database connection failed')
    }

    const { data: listing, error } = await supabase
      .from('listings')
      .select('price_per_night')
      .eq('id', listingId)
      .single()

    if (error || !listing) {
      throw new Error('Listing not found')
    }

    const basePrice = listing.price_per_night

    // Calculate with verified base price
    const result = await calculateBookingPrice(listingId, basePrice, checkIn, checkOut)
    return result
  } catch (error) {
    console.error('Error calculating price:', error)
    // Return error state - don't use _basePrice as fallback either
    const nights = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
    )
    return {
      subtotal: 0,
      nights,
      pricePerNight: [],
      error: 'Unable to calculate price'
    }
  }
}
