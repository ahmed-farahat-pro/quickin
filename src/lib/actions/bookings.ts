'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { systemReleaseEscrow } from './escrow'
import { calculateRefund, type PolicySnapshot, type RefundCalculation } from '@/lib/utils/refund-calculator'

/**
 * Updates a booking status (e.g. host approving or rejecting a booking).
 * Verifies that the current user owns the listing associated with the booking.
 */
export async function updateBookingStatusHost(bookingId: string, newStatus: 'confirmed' | 'rejected' | 'pending') {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Admin database not configured' }

  // Verify the booking exists and the user is the host
  const { data: booking, error: fetchError } = await adminClient
    .from('bookings')
    .select('id, status, listings(user_id)')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { error: 'Booking not found' }
  }

  // Handle case where listings is an array or object depending on schema relations
  const listingData = booking.listings as any
  const hostId = Array.isArray(listingData) ? listingData[0]?.user_id : listingData?.user_id

  if (hostId !== user.id) {
    return { error: 'Unauthorized: Only the host can update this booking status' }
  }

  // Allow undoing to pending if currently rejected, or moving from pending to confirmed/rejected
  if (booking.status === newStatus) {
    return { success: true }
  }

  const { error: updateError } = await adminClient
    .from('bookings')
    .update({ 
      status: newStatus, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', bookingId)

  if (updateError) {
    console.error('Failed to update booking status:', updateError)
    return { error: 'Failed to update booking status' }
  }

  // Audit log
  await supabase.rpc('create_audit_log', {
    p_action: 'booking.status_update',
    p_entity_type: 'booking',
    p_entity_id: bookingId,
    p_entity_name: `Booking Status`,
    p_old_data: { status: booking.status },
    p_new_data: { status: newStatus },
    p_notes: `Host updated booking status to ${newStatus}`
  })

  return { success: true }
}

/**
 * Updates a booking status for a guest (e.g. undoing a cancellation request).
 * Verifies that the current user is the guest who made the booking.
 */
export async function updateBookingStatusGuest(bookingId: string, newStatus: 'cancelled' | 'pending', expectedStatus?: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Admin database not configured' }

  const { data: booking, error: fetchError } = await adminClient
    .from('bookings')
    .select('id, user_id, status, subtotal, check_in, reservation_code, cancellation_policy_snapshot')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { error: 'Booking not found' }
  }

  if (booking.user_id !== user.id) {
    return { error: 'Unauthorized: Only the guest can update this booking status' }
  }

  if (expectedStatus && booking.status !== expectedStatus) {
    return { error: `Booking status has changed to ${booking.status}. Please refresh.` }
  }

  if (booking.status === newStatus) {
    return { success: true }
  }

  // Handle cancellation with refund calculation
  if (newStatus === 'cancelled') {
    if (booking.status === 'pending') {
      // Just cancel the booking, no refund calculation needed for unapproved bookings
      const { error: updateError } = await adminClient
        .from('bookings')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      if (updateError) {
        console.error('Failed to update booking status:', updateError)
        return { error: 'Failed to update booking status' }
      }

      await adminClient.from('user_notifications').insert({
        user_id: user.id,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `Your booking request (${booking.reservation_code || ''}) has been cancelled.`,
        related_entity_id: bookingId,
        related_entity_type: 'booking',
        is_read: false,
      })

      revalidatePath('/dashboard/trips')
      return { success: true }
    } else if (booking.status === 'confirmed') {
      let policySnapshot = booking.cancellation_policy_snapshot as unknown as PolicySnapshot
      
      // Fallback if snapshot is missing for some reason
      if (!policySnapshot) {
        console.warn(`Booking ${bookingId} missing cancellation policy snapshot. Falling back to default flexible policy.`)
        policySnapshot = {
          code: 'flexible',
          label: 'Flexible',
          full_refund_days_before: 1,
          partial_refund_days_before: 0,
          partial_refund_pct: 0,
          no_refund_days_before: 0
        }
      }

      const refundCalc = calculateRefund(booking.subtotal, booking.check_in, policySnapshot)

      // Update booking status
      const { error: updateError } = await adminClient
        .from('bookings')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      if (updateError) {
        console.error('Failed to update booking status:', updateError)
        return { error: 'Failed to update booking status' }
      }

      // Create refund record (amount is computed via calc_refund_amount() after insert)
      await adminClient.from('refunds').insert({
        booking_id: bookingId,
        refund_type: refundCalc.refundType,
        policy_applied: refundCalc.policyCode,
        status: 'pending',
        initiated_by: user.id,
        reason: `Guest cancelled ${refundCalc.daysBeforeCheckIn} days before check-in. Policy: ${refundCalc.policyCode}.`,
      })

      // Create escrow audit record for the refund (no amount — amounts live in transactions)
      if (refundCalc.refundAmount > 0) {
        await adminClient.from('escrow').insert({
          booking_id: bookingId,
          type: 'refund',
          status: 'pending',
          initiated_by: user.id,
          notes: `Guest cancellation refund (${refundCalc.refundPercentage}%). Policy: ${refundCalc.policyCode}`,
        })
      }

      // Staff notification for refund processing
      await adminClient.from('staff_notifications').insert({
        type: 'refund_request',
        title: 'New Refund Request',
        message: `Booking ${booking.reservation_code || bookingId} cancelled by guest. Refund: ${refundCalc.refundAmount} EGP (${refundCalc.refundPercentage}%). Policy: ${policySnapshot.label || refundCalc.policyCode}.`,
        related_entity_id: bookingId,
        related_entity_type: 'booking',
        is_read: false,
      })

      // Guest notification
      const refundMsg = refundCalc.refundAmount > 0
        ? `You are eligible for a ${refundCalc.refundType} refund of ${refundCalc.refundAmount} EGP (${refundCalc.refundPercentage}%). It will be processed shortly.`
        : `Based on the ${policySnapshot.label || refundCalc.policyCode} policy, no refund is applicable for this cancellation.`

      await adminClient.from('user_notifications').insert({
        user_id: user.id,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `Your booking (${booking.reservation_code || ''}) has been cancelled. ${refundMsg}`,
        related_entity_id: bookingId,
        related_entity_type: 'booking',
        is_read: false,
      })

      revalidatePath('/dashboard/trips')
      return { success: true, refund: refundCalc }
    }
  }

  // Non-cancellation status update (e.g. undoing cancellation back to pending)
  const { error: updateError } = await adminClient
    .from('bookings')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', bookingId)

  if (updateError) {
    console.error('Failed to update booking status:', updateError)
    return { error: 'Failed to update booking status' }
  }

  revalidatePath('/dashboard/trips')
  return { success: true }
}

/**
 * Preview refund calculation for a booking without actually cancelling.
 */
export async function previewCancellationRefund(bookingId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Admin database not configured' }

  const { data: booking, error: fetchError } = await adminClient
    .from('bookings')
    .select('id, user_id, subtotal, check_in, cancellation_policy_snapshot')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) return { error: 'Booking not found' }
  if (booking.user_id !== user.id) return { error: 'Unauthorized' }
  if (!booking.cancellation_policy_snapshot) return { error: 'No cancellation policy found' }

  const policySnapshot = booking.cancellation_policy_snapshot as unknown as PolicySnapshot
  const refundCalc = calculateRefund(booking.subtotal, booking.check_in, policySnapshot)

  return {
    success: true,
    refund: refundCalc,
    policyLabel: policySnapshot.label,
    totalPrice: booking.subtotal,
  }
}

/**
 * Confirms the check-in for a booking by a guest.
 */
export async function confirmCheckIn(bookingId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Admin database not configured' }

  const { data: booking, error: fetchError } = await adminClient
    .from('bookings')
    .select('id, user_id, status')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { error: 'Booking not found' }
  }

  if (booking.user_id !== user.id) {
    return { error: 'Unauthorized: Only the guest can confirm check-in' }
  }

  const { error: updateError } = await adminClient
    .from('bookings')
    .update({ 
      status: 'active',
      is_check_in_confirmed: true, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', bookingId)

  if (updateError) {
    console.error('Failed to confirm check-in:', updateError)
    return { error: 'Failed to confirm check-in' }
  }
  
  // Directly release funds if the booking was confirmed and held.
  if (booking.status === 'confirmed') {
    const releaseResult = await systemReleaseEscrow(bookingId)
    if (releaseResult.error) {
       console.error('Check-in confirmed but escrow release failed:', releaseResult.error);
       // We still return success for check-in step but log the error
    }
  }

  revalidatePath('/dashboard/trips')
  return { success: true }
}
