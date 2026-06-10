'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from './auth-actions'
import { sendFCMNotification } from '../actions/notifications'
import { getCommissionRates } from '../actions/platform-settings'
import { calculateBookingPrice } from './queries'

/**
 * Validates that no blocked or booked dates exist within the requested range [checkIn, checkOut).
 * Uses a SECURITY DEFINER RPC function so it can see all bookings regardless of RLS,
 * without requiring the admin client. Only a boolean + reason string are returned.
 */
export async function validateDateRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  checkIn: string,
  checkOut: string
): Promise<string | null> {
  if (!supabase) return 'Database not configured'

  const { data, error } = await supabase
    .rpc('check_listing_availability', {
      p_listing_id: listingId,
      p_check_in: checkIn,
      p_check_out: checkOut,
    })
    .single()

  if (error) {
    console.error('Error checking availability:', error)
    return 'Failed to validate availability'
  }

  const result = data as any;

  if (result?.has_conflict) {
    return result.conflict_reason
  }

  return null
}

export async function createBooking(data: {
  listingId: string
  checkIn: string
  checkOut: string
  guests: number
  totalPrice: number
  receiptUrl?: string
  payWithBalance?: boolean
}) {
  const user = await getUser()
  if (!user) {
    return { error: 'You must be logged in to book' }
  }

  // Ensure payment method is valid
  if (!data.payWithBalance && !data.receiptUrl) {
    return { error: 'Payment receipt is required for wallet payments' }
  }

  if (data.receiptUrl) {
    const adminClient = await createAdminClient()
    if (!adminClient) return { error: 'Database admin not configured' }

    const urlParts = data.receiptUrl.split('/')
    const fileName = urlParts[urlParts.length - 1]?.split('?')[0]

    if (!fileName) {
      return { error: 'Invalid receipt URL format' }
    }

    const { data: files, error: listError } = await adminClient.storage
      .from('receipts')
      .list('', { search: fileName })

    if (listError || !files || files.length === 0 || !files.some(f => f.name === fileName)) {
      return { error: 'Receipt verification failed. Please upload a valid receipt.' }
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { error: 'Database not configured' }
  }

  // Validate date sanity
  const checkInDate = new Date(data.checkIn + 'T00:00:00')
  const checkOutDate = new Date(data.checkOut + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return { error: 'Invalid date format' }
  }
  if (checkInDate < today) {
    return { error: 'Check-in date cannot be in the past' }
  }
  if (checkOutDate <= checkInDate) {
    return { error: 'Check-out date must be after check-in date' }
  }

  // Validate that the date range has no blocked or booked dates.
  // The RPC uses SECURITY DEFINER to see all bookings regardless of RLS.
  const validationError = await validateDateRange(supabase, data.listingId, data.checkIn, data.checkOut)
  if (validationError) {
    return { error: validationError }
  }

  // Snapshot the listing's cancellation policy
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  const { data: listingFull } = await adminClient
    .from('listings')
    .select('cancellation_policy, title, user_id, price_per_night, max_guests')
    .eq('id', data.listingId)
    .single()

  if (!listingFull?.price_per_night) {
    return { error: 'Listing price not available' }
  }

  // Validate guest count against listing capacity
  if (data.guests > (listingFull.max_guests || 1)) {
    return { error: `Guest count exceeds the maximum of ${listingFull.max_guests || 1}` }
  }
  if (data.guests < 1) {
    return { error: 'At least 1 guest is required' }
  }

  let cancellationSnapshot = null
  if (listingFull?.cancellation_policy) {
    const { data: policyData } = await adminClient
      .from('cancellation_policies')
      .select('*')
      .eq('code', listingFull.cancellation_policy)
      .single()
    cancellationSnapshot = policyData || { code: listingFull.cancellation_policy }
  }

  // Compute subtotal server-side to avoid stale or tampered pricing
  const priceData = await calculateBookingPrice(
    data.listingId,
    listingFull.price_per_night,
    data.checkIn,
    data.checkOut
  )

  // Compute commission fees
  const rates = await getCommissionRates()
  const subtotal = priceData.subtotal // Sum of nightly prices before guest fee
  const bestOfferSubtotal = (priceData.pricePerNight || []).reduce((sum, night) => {
    if (night.adjustmentName === 'Best Offer') {
      return sum + night.price
    }
    return sum
  }, 0)
  const guestFee = Math.round(subtotal * rates.guestRate)
  const totalWithGuestFee = subtotal + guestFee

  // Guard against stale client totals (wallet payment relies on this)
  if (Math.abs(data.totalPrice - totalWithGuestFee) > 1) {
    return { error: 'Pricing has changed. Please refresh and try again.' }
  }

  let status = 'pending'
  let escrowStatus = 'none'

  // If paying with balance
  if (data.payWithBalance) {
    // Check user balance via RPC (derived from transactions ledger)
    const { data: balanceData, error: balanceError } = await adminClient
      .rpc('get_user_balance', { p_user_id: user.id }) as { data: { available_balance: number } | null; error: any }

    if (balanceError || !balanceData || balanceData.available_balance < totalWithGuestFee) {
      return { error: 'Insufficient platform balance to cover the booking' }
    }

    status = 'confirmed'
    escrowStatus = 'held'
  }

  const payload = {
    listing_id: data.listingId,
    user_id: user.id,
    check_in: data.checkIn,
    check_out: data.checkOut,
    guests: data.guests,
    subtotal,
    best_offer_subtotal: bestOfferSubtotal,
    commission_rate_id: rates.id,
    status: status,
    receipt_url: data.receiptUrl,
    cancellation_policy_snapshot: cancellationSnapshot,
    escrow_status: escrowStatus,
  }
  const { data: newBooking, error } = await supabase.from('bookings').insert(payload).select('id').single()

  if (error || !newBooking) {
    console.error('Error creating booking:', error)
    return { error: 'Failed to create booking' }
  }

  if (data.payWithBalance) {
    // Create payment + guest_fee transaction rows in the ledger
    await adminClient
      .from('transactions')
      .insert([
        {
          user_id: user.id,
          type: 'payment' as const,
          amount: -subtotal,
          booking_id: newBooking.id,
          balance_impact: true,
          notes: `Payment for booking at ${listingFull?.title || 'listing'}`,
        },
        {
          user_id: user.id,
          type: 'guest_fee' as const,
          amount: -guestFee,
          booking_id: newBooking.id,
          balance_impact: true,
          notes: 'Platform service fee',
        },
      ])

    // Create escrow audit record (no amount)
    await adminClient
      .from('escrow')
      .insert({
        booking_id: newBooking.id,
        type: 'hold',
        status: 'completed',
        initiated_by: user.id,
        completed_at: new Date().toISOString(),
        notes: 'Funds held from wallet balance payment',
      })
      
    // Notify host of confirmed booking
    if (listingFull?.user_id) {
       const hostId = listingFull.user_id
       const { data: hostProfile } = await adminClient.from('profiles').select('fcm_token').eq('id', hostId).single()
       if (hostProfile?.fcm_token) {
           sendFCMNotification([hostProfile.fcm_token], 'New Booking Confirmed!', `A guest has booked ${listingFull.title} and paid via platform balance.`, { type: 'new_booking', bookingId: newBooking.id }).catch(console.error)
       }
       
       await adminClient.from('user_notifications').insert({
           user_id: hostId,
           type: 'booking_confirmed',
           title: 'New Booking Confirmed!',
           message: `A guest has booked ${listingFull.title} and paid via platform balance.`,
           related_entity_id: newBooking.id,
           related_entity_type: 'booking'
       })
    }
  }

  // Fetch listing title for the push notification
  const listingData = listingFull

  // Notify admins via FCM
  if (adminClient && status === 'pending') {
    const { data: staffMembers } = await adminClient
      .from('staff_profiles')
      .select('fcm_token')
      .not('fcm_token', 'is', null)

    if (staffMembers && staffMembers.length > 0) {
      const tokens = staffMembers.map(s => s.fcm_token).filter(Boolean) as string[]

      const title = 'New Booking Request'
      const body = `A new booking request has been submitted for: ${listingData?.title || 'Unknown Listing'}`

      // We don't await this so we don't block the user's booking response
      sendFCMNotification(tokens, title, body, {
        type: 'new_booking',
        bookingId: newBooking.id
      }).catch(console.error)
    }
  }

  revalidatePath('/dashboard/trips')
  return { success: true, bookingId: newBooking.id }
}

export async function uploadReceiptAndUpdateBooking(formData: FormData) {
  console.log('[DEBUG] uploadReceiptAndUpdateBooking started');
  const user = await getUser()
  if (!user) {
    console.error('[DEBUG] Failed: user not logged in');
    return { error: 'You must be logged in' }
  }
  
  // Note: Using adminClient for everything here to guarantee it works. 
  // If the bucket has strict RLS, it won't block the admin client.
  const adminClient = await createAdminClient()
  if (!adminClient) {
    console.error('[DEBUG] Failed: adminClient not configured');
    return { error: 'Admin database not configured' }
  }

  const bookingId = formData.get('bookingId') as string
  const file = formData.get('file') as File

  if (!bookingId || !file) {
    console.error('[DEBUG] Failed: Missing bookingId or file', { bookingId, hasFile: !!file });
    return { error: 'Missing booking ID or file' }
  }

  console.log(`[DEBUG] Attempting to upload to receipts bucket for booking: ${bookingId}, file name: ${file.name}, size: ${file.size}`);

  const fileExt = file.name.split('.').pop()
  const fileName = `${bookingId}-${Date.now()}.${fileExt}`
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from('receipts')
    .upload(fileName, file)

  if (uploadError) {
    console.error('[DEBUG] Error uploading receipt:', uploadError)
    return { error: 'Failed to upload receipt image: ' + uploadError.message }
  }

  console.log('[DEBUG] Upload success:', uploadData);

  const { data: { publicUrl } } = adminClient.storage
    .from('receipts')
    .getPublicUrl(uploadData.path)
    
  console.log(`[DEBUG] Updating booking ${bookingId} for user ${user.id} with URL ${publicUrl}`);

  const { error: updateError, data: updatedBooking } = await adminClient
    .from('bookings')
    .update({ receipt_url: publicUrl })
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .select('id').single()

  if (updateError) {
    console.error('[DEBUG] Error updating booking with receipt url:', updateError)
    return { error: 'Failed to link receipt to booking: ' + updateError.message }
  }
  
  console.log('[DEBUG] Booking updated successfully:', updatedBooking);

  revalidatePath('/dashboard/trips')
  console.log('[DEBUG] uploadReceiptAndUpdateBooking finished successfully');
  return { success: true, receiptUrl: publicUrl }
}

export async function uploadReceiptMobileHandoff(formData: FormData) {
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  const bookingId = formData.get('bookingId') as string
  const file = formData.get('file') as File

  if (!bookingId || !file) {
    return { error: 'Missing booking ID or file' }
  }

  const { data: booking, error: fetchError } = await adminClient
    .from('bookings')
    .select('status, receipt_url')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    console.error('Mobile Handoff Fetch Error:', fetchError)
    console.error('Mobile Handoff Booking ID:', bookingId)
    return { error: 'Invalid booking' }
  }
  if (booking.status !== 'pending') return { error: 'Booking is no longer pending' }
  if (booking.receipt_url) return { error: 'A receipt has already been uploaded for this booking' }

  const fileExt = file.name.split('.').pop()
  const fileName = `${bookingId}-mobile-${Date.now()}.${fileExt}`
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from('receipts')
    .upload(fileName, file)

  if (uploadError) {
    console.error('Error uploading mobile receipt:', uploadError)
    return { error: 'Failed to upload receipt image' }
  }

  const { data: { publicUrl } } = adminClient.storage
    .from('receipts')
    .getPublicUrl(uploadData.path)

  const { error: updateError } = await adminClient
    .from('bookings')
    .update({ receipt_url: publicUrl })
    .eq('id', bookingId)

  if (updateError) {
    console.error('Error updating booking with mobile receipt url:', updateError)
    return { error: 'Failed to link receipt to booking' }
  }

  revalidatePath('/dashboard/trips')
  revalidatePath(`/pay/${bookingId}`)
  return { success: true, receiptUrl: publicUrl }
}

export async function uploadHandoffReceipt(formData: FormData) {
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  const sessionId = formData.get('sessionId') as string
  const file = formData.get('file') as File

  if (!sessionId || !file) {
    return { error: 'Missing session ID or file' }
  }

  const fileExt = file.name.split('.').pop()
  const fileName = `handoff-${sessionId}-${Date.now()}.${fileExt}`
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from('receipts')
    .upload(fileName, file)

  if (uploadError) {
    console.error('Error uploading mobile receipt:', uploadError)
    return { error: 'Failed to upload receipt image' }
  }

  const { data: { publicUrl } } = adminClient.storage
    .from('receipts')
    .getPublicUrl(uploadData.path)

  return { success: true, receiptUrl: publicUrl }
}

export async function cancelBooking(bookingId: string) {
  const user = await getUser()
  if (!user) {
    return { error: 'You must be logged in' }
  }

  const adminClient = await createAdminClient()
  if (!adminClient) {
    return { error: 'Admin database not configured' }
  }

  const { error } = await adminClient
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error cancelling booking:', error)
    return { error: 'Failed to cancel booking' }
  }

  revalidatePath('/dashboard/trips')
  return { success: true }
}

export async function getBookings(searchQuery?: string) {
  const user = await getUser()
  if (!user) {
    return []
  }

  const supabase = await createClient()
  if (!supabase) {
    return []
  }

  let query = supabase
    .from('bookings')
    .select(`
      *,
      listing:listings(id, title, location, listing_images(url, order)),
      commission_rates:commission_rates(guest_rate),
      booking_messages(count)
    `)
    .eq('user_id', user.id)

  if (searchQuery) {
    query = query.eq('reservation_code', searchQuery)
  }

  const { data, error } = await query.order('check_in', { ascending: false })

  if (error) {
    console.error('Error fetching bookings:', error)
    return []
  }

  // Transform listing_images and compute total_with_fees
  return (data || []).map((booking: any) => {
    const rates = Array.isArray(booking.commission_rates) ? booking.commission_rates[0] : booking.commission_rates
    const guestRate = rates?.guest_rate ?? 0.02
    const guestFee = Math.round((booking.subtotal || 0) * guestRate)
    
    const messagesCount = Array.isArray(booking.booking_messages) 
      ? (booking.booking_messages[0] as any)?.count || 0 
      : 0

    return {
      ...booking,
      total_with_fees: (booking.subtotal || 0) + guestFee,
      message_count: messagesCount,
      listing: booking.listing ? {
        ...booking.listing,
        images: booking.listing.listing_images
          ? booking.listing.listing_images.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)).map((i: any) => i.url)
          : []
      } : null
    }
  })
}
