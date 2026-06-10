'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { DayAvailability } from '@/components/features/host/availability-calendar'
import { eachDayOfInterval, format, parseISO, areIntervalsOverlapping, addDays } from 'date-fns'

export async function updateAvailability(
  listingId: string,
  updates: DayAvailability[]
) {
  const supabase = await createClient()

  if (!supabase) {
    return { error: 'System configuration error' }
  }

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized' }
  }

  // 2. Verify ownership
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('user_id')
    .eq('id', listingId)
    .single()

  if (listingError || !listing || listing.user_id !== user.id) {
    return { error: 'Unauthorized: You do not own this listing' }
  }

  // 3. Fetch active bookings and offers to validate against
  // We need to check if any of the dates being updated are already blocked
  if (updates.length === 0) return { success: true }

  // Get range of updates
  const updateDates = updates.map(u => new Date(u.date))
  const sortedDates = updateDates.sort((a, b) => a.getTime() - b.getTime())
  const startDate = sortedDates[0]
  const endDate = sortedDates[sortedDates.length - 1]

  // Buffer range slightly to be safe
  const queryStart = format(startDate, 'yyyy-MM-dd')
  const queryEnd = format(endDate, 'yyyy-MM-dd')

  // Fetch bookings overlapping the update range
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('check_in, check_out, status')
    .eq('listing_id', listingId)
    .in('status', ['confirmed', 'active', 'pending'])
    // check_in <= queryEnd AND check_out >= queryStart
    .or(`check_in.lte.${queryEnd},check_out.gte.${queryStart}`)

  if (bookingsError) {
    console.error('Error fetching bookings:', bookingsError)
    return { error: 'Failed to validate availability' }
  }

  // Fetch best offers overlapping the update range
  const { data: offers, error: offersError } = await supabase
    .from('listing_best_offers')
    .select('start_date, end_date, status')
    .eq('listing_id', listingId)
    .in('status', ['requested', 'approved'])
    .or(`start_date.lte.${queryEnd},end_date.gte.${queryStart}`)

  if (offersError) {
    console.error('Error fetching offers:', offersError)
    return { error: 'Failed to validate availability' }
  }

  // 4. Validate each update
  const lockedDates = new Set<string>()

  // Process bookings into locked dates
  bookings?.forEach(booking => {
    // Check-out date is usually not blocked for staying, but availability logic might vary.
    // Standard logic: check-in is booked, check-out is available for next guest.
    // However, for blocking *modification* by host, we should probably be strict.
    // If a guest is there from 1st to 5th, the host cannot change price/availability for 1, 2, 3, 4.
    // The 5th is check-out, so morning is occupied, afternoon available.
    // Safest to block check-out date from modification too, or at least be careful.
    // Let's use standard interval: [start, end)
    
    // Actually, eachDayOfInterval is inclusive.
    // Booking: 1st to 5th.
    // Nights: 1, 2, 3, 4.
    // 5th is available for new check-in.
    // So distinct booked dates are 1, 2, 3, 4.
    
    const start = parseISO(booking.check_in)
    const end = parseISO(booking.check_out)
    
    // If start == end (invalid booking?), skip
    if (start >= end) return

    // Get days: start -> end - 1 day
    // date-fns doesn't have "eachDayOfInterval exclusive end", so we manually subtract 1 day from end
    const lastNight = addDays(end, -1)
    
    const days = eachDayOfInterval({ start, end: lastNight })
    days.forEach(day => lockedDates.add(format(day, 'yyyy-MM-dd')))
  })

  // Process offers into locked dates (inclusive range)
  offers?.forEach(offer => {
    const start = parseISO(offer.start_date)
    const end = parseISO(offer.end_date)
    // Best offers are typically "for these nights", so inclusive.
    const days = eachDayOfInterval({ start, end })
    days.forEach(day => lockedDates.add(format(day, 'yyyy-MM-dd')))
  })

  // Check for conflicts
  for (const update of updates) {
    const dateKey = format(new Date(update.date), 'yyyy-MM-dd')
    if (lockedDates.has(dateKey)) {
      return { error: `Cannot modify date ${dateKey} because it is booked or has a pending offer.` }
    }
  }

  // 5. Perform Upsert
  const { error: upsertError } = await supabase
    .from('listing_availability')
    .upsert(
      updates.map(u => ({
        listing_id: listingId,
        date: format(new Date(u.date), 'yyyy-MM-dd'),
        is_available: u.isAvailable,
        price_override: u.priceOverride,
        note: u.note
      })),
      { onConflict: 'listing_id,date' }
    )

  if (upsertError) {
    console.error('Error updating availability:', upsertError)
    return { error: 'Failed to save changes' }
  }

  revalidatePath(`/dashboard/listings/${listingId}/manage`)
  return { success: true }
}
