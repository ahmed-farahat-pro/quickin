'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendFCMNotification } from '@/lib/actions/notifications'
import { refundEscrow, systemReleaseEscrow } from '@/lib/actions/escrow'

// ---------------------------------------------------------------------------
// Types for Supabase join results
// ---------------------------------------------------------------------------

type SupabaseJoinResult<T> = T | T[] | null

type ListingJoinRow = { title?: string; user_id?: string; price_per_night?: number; max_guests?: number }
type ProfileJoinRow = { full_name?: string | null; email?: string }

/** Resolve a Supabase join that may return an array or single object. */
function resolveJoin<T>(data: SupabaseJoinResult<T>): T | null {
  if (data == null) return null
  return Array.isArray(data) ? data[0] ?? null : data
}

// ---------------------------------------------------------------------------
// Helpers (private)
// ---------------------------------------------------------------------------

/** Safely extract the host user_id from a Supabase join that may be an array or object. */
function extractHostId(listing: unknown): string | null {
  const data = listing as SupabaseJoinResult<ListingJoinRow>
  if (!data) return null
  const resolved = Array.isArray(data) ? data[0] : data
  return resolved?.user_id ?? null
}

/** Send both a DB notification and an FCM push to a single user. */
async function notifyUser(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  payload: {
    type: string
    title: string
    message: string
    relatedEntityId: string
    relatedEntityType: string
    fcmData?: Record<string, string>
  },
) {
  if (!adminClient || !userId) return

  // 1. DB notification
  await adminClient.from('user_notifications').insert({
    user_id: userId,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    related_entity_id: payload.relatedEntityId,
    related_entity_type: payload.relatedEntityType,
  })

  // 2. FCM push
  const { data: profile } = await adminClient
    .from('profiles')
    .select('fcm_token')
    .eq('id', userId)
    .single()

  if (profile?.fcm_token) {
    sendFCMNotification(
      [profile.fcm_token],
      payload.title,
      payload.message,
      payload.fcmData ?? { type: payload.type, bookingId: payload.relatedEntityId },
    ).catch(console.error)
  }
}

// ---------------------------------------------------------------------------
// 1. Admin Cancel Booking
// ---------------------------------------------------------------------------

export async function adminCancelBooking(bookingId: string, reason: string) {
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  if (!bookingId || !reason) {
    return { error: 'Booking ID and reason are required' }
  }

  try {
    // Fetch booking with related data
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select(`
        id, status, user_id, listing_id, escrow_status,
        check_in, check_out,
        listings (title, user_id),
        profiles!bookings_user_id_fkey(full_name)
      `)
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      console.error('Error fetching booking:', fetchError)
      return { error: 'Failed to find booking' }
    }

    // Guard on status
    const allowedStatuses = ['pending', 'stalled', 'confirmed']
    if (!allowedStatuses.includes(booking.status)) {
      return { error: `Cannot cancel. Booking is currently "${booking.status}".` }
    }

    // Perform the operation
    if (booking.status === 'confirmed' && booking.escrow_status === 'held') {
      // Full refund via escrow (handles status change internally)
      const result = await refundEscrow(bookingId, 0, reason, 'full')
      if (result && 'error' in result) {
        return { error: result.error as string }
      }
    } else {
      // pending / stalled / confirmed without held escrow — just update status
      const { error: updateError } = await adminClient
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)

      if (updateError) {
        console.error('Error cancelling booking:', updateError)
        return { error: 'Failed to cancel booking' }
      }
    }

    // Audit log
    const listing = resolveJoin(booking.listings as SupabaseJoinResult<ListingJoinRow>)
    const listingTitle = listing?.title ?? 'Unknown listing'

    await adminClient.rpc('create_audit_log', {
      p_action: 'admin.booking.cancel',
      p_entity_type: 'booking',
      p_entity_id: bookingId,
      p_entity_name: listingTitle,
      p_new_data: { reason, previous_status: booking.status },
    })

    // Notify guest
    if (booking.user_id) {
      await notifyUser(adminClient, booking.user_id, {
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `Your booking for ${listingTitle} has been cancelled by an administrator. Reason: ${reason}`,
        relatedEntityId: bookingId,
        relatedEntityType: 'booking',
      })
    }

    // Notify host
    const hostId = extractHostId(booking.listings)
    if (hostId) {
      const guest = resolveJoin(booking.profiles as SupabaseJoinResult<ProfileJoinRow>)
      const guestName = guest?.full_name

      await notifyUser(adminClient, hostId, {
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `The booking for ${listingTitle} by ${guestName || 'a guest'} has been cancelled by an administrator. Reason: ${reason}`,
        relatedEntityId: bookingId,
        relatedEntityType: 'booking',
      })
    }

    revalidatePath('/admin/bookings')
    revalidatePath('/admin/payments')
    revalidatePath('/dashboard/trips')
    return { success: true }
  } catch (err) {
    console.error('adminCancelBooking error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

// ---------------------------------------------------------------------------
// 2. Admin Force Complete
// ---------------------------------------------------------------------------

export async function adminForceComplete(bookingId: string, reason: string) {
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  if (!bookingId || !reason) {
    return { error: 'Booking ID and reason are required' }
  }

  try {
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select('id, status, escrow_status, listing_id, listings (title)')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      console.error('Error fetching booking:', fetchError)
      return { error: 'Failed to find booking' }
    }

    if (booking.status !== 'active') {
      return { error: `Cannot force-complete. Booking is currently "${booking.status}".` }
    }

    // Release escrow if held (bypasses check-in guard)
    if (booking.escrow_status === 'held') {
      const result = await systemReleaseEscrow(bookingId)
      if (result && 'error' in result) {
        console.error('Escrow release failed:', result.error)
        // Continue with completion even if escrow release fails — admin override
      }
    }

    // Update status
    const { error: updateError } = await adminClient
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Error completing booking:', updateError)
      return { error: 'Failed to complete booking' }
    }

    // Audit log
    const listing = resolveJoin(booking.listings as SupabaseJoinResult<ListingJoinRow>)
    const listingTitle = listing?.title ?? 'Unknown listing'

    await adminClient.rpc('create_audit_log', {
      p_action: 'admin.booking.force_complete',
      p_entity_type: 'booking',
      p_entity_id: bookingId,
      p_entity_name: listingTitle,
      p_new_data: { reason, previous_status: 'active' },
    })

    revalidatePath('/admin/bookings')
    revalidatePath('/admin/payments')
    revalidatePath('/dashboard/trips')
    return { success: true }
  } catch (err) {
    console.error('adminForceComplete error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

// ---------------------------------------------------------------------------
// 3. Admin Force Check-in
// ---------------------------------------------------------------------------

export async function adminForceCheckin(bookingId: string, reason: string) {
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  if (!bookingId || !reason) {
    return { error: 'Booking ID and reason are required' }
  }

  try {
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select(`
        id, status, user_id, listing_id,
        check_in, check_out,
        listings (title, user_id),
        profiles!bookings_user_id_fkey(full_name)
      `)
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      console.error('Error fetching booking:', fetchError)
      return { error: 'Failed to find booking' }
    }

    if (booking.status !== 'confirmed') {
      return { error: `Cannot force check-in. Booking is currently "${booking.status}".` }
    }

    // Update status + check-in flag
    const { error: updateError } = await adminClient
      .from('bookings')
      .update({ status: 'active', is_check_in_confirmed: true })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Error forcing check-in:', updateError)
      return { error: 'Failed to force check-in' }
    }

    // Audit log
    const listing = resolveJoin(booking.listings as SupabaseJoinResult<ListingJoinRow>)
    const listingTitle = listing?.title ?? 'Unknown listing'

    await adminClient.rpc('create_audit_log', {
      p_action: 'admin.booking.force_checkin',
      p_entity_type: 'booking',
      p_entity_id: bookingId,
      p_entity_name: listingTitle,
      p_new_data: { reason },
    })

    // Notify guest
    if (booking.user_id) {
      await notifyUser(adminClient, booking.user_id, {
        type: 'booking_checkin',
        title: 'Check-in Confirmed',
        message: `Your check-in for ${listingTitle} has been confirmed by an administrator.`,
        relatedEntityId: bookingId,
        relatedEntityType: 'booking',
      })
    }

    // Notify host
    const hostId = extractHostId(booking.listings)
    if (hostId) {
      const guest = resolveJoin(booking.profiles as SupabaseJoinResult<ProfileJoinRow>)
      const guestName = guest?.full_name

      await notifyUser(adminClient, hostId, {
        type: 'booking_checkin',
        title: 'Guest Checked In',
        message: `${guestName || 'A guest'} has been checked in to ${listingTitle} by an administrator.`,
        relatedEntityId: bookingId,
        relatedEntityType: 'booking',
      })
    }

    revalidatePath('/admin/bookings')
    revalidatePath('/dashboard/trips')
    return { success: true }
  } catch (err) {
    console.error('adminForceCheckin error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

// ---------------------------------------------------------------------------
// 4. Admin Delete Booking
// ---------------------------------------------------------------------------

export async function adminDeleteBooking(bookingId: string, reason: string) {
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  if (!bookingId || !reason) {
    return { error: 'Booking ID and reason are required' }
  }

  try {
    // Fetch full booking data for audit snapshot
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select(`
        id, status, user_id, listing_id,
        check_in, check_out, guests, subtotal,
        escrow_status, paid_amount, created_at,
        listings (title, user_id),
        profiles!bookings_user_id_fkey(full_name, email)
      `)
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      console.error('Error fetching booking:', fetchError)
      return { error: 'Failed to find booking' }
    }

    // Guard on status
    const allowedStatuses = ['pending', 'stalled', 'rejected']
    if (!allowedStatuses.includes(booking.status)) {
      return { error: `Cannot delete. Booking is currently "${booking.status}". Only pending, stalled, or rejected bookings can be deleted.` }
    }

    // Snapshot booking data to audit log BEFORE deletion
    const listing = resolveJoin(booking.listings as SupabaseJoinResult<ListingJoinRow>)
    const listingTitle = listing?.title ?? 'Unknown listing'

    await adminClient.rpc('create_audit_log', {
      p_action: 'admin.booking.delete',
      p_entity_type: 'booking',
      p_entity_id: bookingId,
      p_entity_name: listingTitle,
      p_new_data: {
        reason,
        snapshot: {
          id: booking.id,
          status: booking.status,
          user_id: booking.user_id,
          listing_id: booking.listing_id,
          check_in: booking.check_in,
          check_out: booking.check_out,
          guests: booking.guests,
          subtotal: booking.subtotal,
          escrow_status: booking.escrow_status,
          paid_amount: booking.paid_amount,
          created_at: booking.created_at,
        },
      },
    })

    // Delete related notifications
    await adminClient
      .from('user_notifications')
      .delete()
      .eq('related_entity_id', bookingId)
      .eq('related_entity_type', 'booking')

    // Delete the booking itself
    const { error: deleteError } = await adminClient
      .from('bookings')
      .delete()
      .eq('id', bookingId)

    if (deleteError) {
      console.error('Error deleting booking:', deleteError)
      return { error: 'Failed to delete booking' }
    }

    revalidatePath('/admin/bookings')
    revalidatePath('/admin/payments')
    revalidatePath('/dashboard/trips')
    return { success: true }
  } catch (err) {
    console.error('adminDeleteBooking error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

// ---------------------------------------------------------------------------
// 5. Admin Edit Booking
// ---------------------------------------------------------------------------

export async function adminEditBooking(
  bookingId: string,
  data: { checkIn: string; checkOut: string; guests: number },
  reason: string,
) {
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  if (!bookingId || !reason) {
    return { error: 'Booking ID and reason are required' }
  }

  if (!data.checkIn || !data.checkOut || !data.guests) {
    return { error: 'Check-in, check-out, and guest count are required' }
  }

  try {
    // Fetch booking + listing details
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select(`
        id, status, user_id, listing_id,
        check_in, check_out, guests, subtotal, escrow_status,
        listings (title, user_id, price_per_night, max_guests),
        profiles!bookings_user_id_fkey(full_name)
      `)
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      console.error('Error fetching booking:', fetchError)
      return { error: 'Failed to find booking' }
    }

    if (booking.status !== 'confirmed') {
      return { error: `Cannot edit. Booking is currently "${booking.status}". Only confirmed bookings can be edited.` }
    }

    const listing = resolveJoin(booking.listings as SupabaseJoinResult<ListingJoinRow>)

    if (!listing) {
      return { error: 'Listing not found for this booking' }
    }

    // Validate guest count
    if (listing.max_guests && data.guests > listing.max_guests) {
      return { error: `Guest count (${data.guests}) exceeds the listing maximum (${listing.max_guests}).` }
    }

    // Validate dates
    const checkInDate = new Date(data.checkIn)
    const checkOutDate = new Date(data.checkOut)
    if (checkOutDate <= checkInDate) {
      return { error: 'Check-out date must be after check-in date.' }
    }

    // Check availability (excluding this booking)
    const { data: availability, error: availError } = await adminClient
      .rpc('check_listing_availability', {
        p_listing_id: booking.listing_id,
        p_check_in: data.checkIn,
        p_check_out: data.checkOut,
        p_exclude_booking_id: bookingId,
      })
      .single()

    if (availError) {
      console.error('Availability check error:', availError)
      return { error: 'Failed to check listing availability' }
    }

    if (availability && !(availability as Record<string, unknown>).is_available) {
      return { error: 'The listing is not available for the selected dates.' }
    }

    // Calculate new subtotal
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    const pricePerNight = listing.price_per_night ?? 0
    const newSubtotal = nights * pricePerNight
    const oldSubtotal = booking.subtotal

    // Update booking
    const { error: updateError } = await adminClient
      .from('bookings')
      .update({
        check_in: data.checkIn,
        check_out: data.checkOut,
        guests: data.guests,
        subtotal: newSubtotal,
      })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Error updating booking:', updateError)
      return { error: 'Failed to update booking' }
    }

    // Handle escrow adjustment if price changed
    if (booking.escrow_status === 'held' && newSubtotal !== oldSubtotal) {
      const diff = newSubtotal - oldSubtotal
      await adminClient.from('transactions').insert({
        user_id: booking.user_id,
        type: diff > 0 ? 'charge' : 'refund',
        amount: Math.abs(diff),
        booking_id: bookingId,
        notes: diff > 0
          ? `Admin booking edit: additional charge of ${Math.abs(diff)} EGP. Reason: ${reason}`
          : `Admin booking edit: refund of ${Math.abs(diff)} EGP. Reason: ${reason}`,
      })
    }

    // Audit log with changes diff
    const listingTitle = listing?.title ?? 'Unknown listing'
    await adminClient.rpc('create_audit_log', {
      p_action: 'admin.booking.edit',
      p_entity_type: 'booking',
      p_entity_id: bookingId,
      p_entity_name: listingTitle,
      p_new_data: {
        reason,
        changes: {
          check_in: { from: booking.check_in, to: data.checkIn },
          check_out: { from: booking.check_out, to: data.checkOut },
          guests: { from: booking.guests, to: data.guests },
          subtotal: { from: oldSubtotal, to: newSubtotal },
        },
      },
    })

    // Notify guest
    if (booking.user_id) {
      await notifyUser(adminClient, booking.user_id, {
        type: 'booking_updated',
        title: 'Booking Updated',
        message: `Your booking for ${listingTitle} has been updated by an administrator. New dates: ${data.checkIn} to ${data.checkOut}. Reason: ${reason}`,
        relatedEntityId: bookingId,
        relatedEntityType: 'booking',
      })
    }

    // Notify host
    const hostId = extractHostId(booking.listings)
    if (hostId) {
      const guest = resolveJoin(booking.profiles as SupabaseJoinResult<ProfileJoinRow>)
      const guestName = guest?.full_name

      await notifyUser(adminClient, hostId, {
        type: 'booking_updated',
        title: 'Booking Updated',
        message: `The booking for ${listingTitle} by ${guestName || 'a guest'} has been updated by an administrator. Reason: ${reason}`,
        relatedEntityId: bookingId,
        relatedEntityType: 'booking',
      })
    }

    revalidatePath('/admin/bookings')
    revalidatePath('/admin/payments')
    revalidatePath('/dashboard/trips')
    return { success: true, newSubtotal, oldSubtotal }
  } catch (err) {
    console.error('adminEditBooking error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

// ---------------------------------------------------------------------------
// 6. Get Booking Details
// ---------------------------------------------------------------------------

export async function getBookingDetails(bookingId: string) {
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  if (!bookingId) {
    return { error: 'Booking ID is required' }
  }

  try {
    // Fetch fee breakdown
    const { data: fees, error: feesError } = await adminClient
      .rpc('calc_booking_fees', { p_booking_id: bookingId })
      .single()

    if (feesError) {
      console.error('Error fetching booking fees:', feesError)
    }

    // Fetch escrow events
    const { data: escrowEvents, error: escrowError } = await adminClient
      .from('escrow')
      .select('id, type, status, created_at, notes')
      .eq('booking_id', bookingId)
      .order('created_at')

    if (escrowError) {
      console.error('Error fetching escrow events:', escrowError)
    }

    // Fetch audit events
    const { data: auditEvents, error: auditError } = await adminClient
      .from('audit_logs')
      .select('id, action, created_at, new_data')
      .eq('entity_type', 'booking')
      .eq('entity_id', bookingId)
      .order('created_at')

    if (auditError) {
      console.error('Error fetching audit events:', auditError)
    }

    return {
      fees: fees ?? null,
      escrowEvents: escrowEvents ?? [],
      auditEvents: auditEvents ?? [],
    }
  } catch (err) {
    console.error('getBookingDetails error:', err)
    return { error: 'An unexpected error occurred' }
  }
}
