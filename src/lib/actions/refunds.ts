'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type RefundType = 'full' | 'partial'
export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processed'

export async function initiateRefund(
  bookingId: string,
  amount: number,
  reason: string,
  refundType: RefundType,
  policyApplied?: string
) {
  const supabase = await createClient()
  if (!supabase) {
    return { error: 'Failed to initialize Supabase client' }
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Unauthorized' }
    }

    const { data: refund, error } = await supabase
      .from('refunds')
      .insert({
        booking_id: bookingId,
        reason,
        refund_type: refundType,
        policy_applied: policyApplied,
        status: 'pending',
        initiated_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error initiating refund:', error)
      return { error: 'Failed to initiate refund' }
    }

    // Compute refund amount from the DB for audit log
    const adminClient = await createAdminClient()
    const { data: computedAmount } = adminClient
      ? await adminClient.rpc('calc_refund_amount', { p_refund_id: refund.id }).single() as { data: number | null }
      : { data: null }

    await supabase.rpc('create_audit_log', {
      p_action: 'refund.initiate',
      p_entity_type: 'refund',
      p_entity_id: refund.id,
      p_entity_name: `Refund for booking ${bookingId}`,
      p_old_data: null,
      p_new_data: refund,
      p_notes: `Refund initiated: ${computedAmount ?? 'unknown'} EGP`
    })

    revalidatePath('/admin/refunds')
    revalidatePath('/admin/financials')
    revalidatePath('/dashboard/bookings')

    return { success: true, refund }
  } catch (error) {
    console.error('Exception in initiateRefund:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function approveRefund(refundId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Failed to initialize Supabase client' }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'Unauthorized' }

    // Staff check
    const { data: staff } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()

    if (!staff) return { error: 'Insufficient permissions' }

    const adminClient = await createAdminClient()
    if (!adminClient) return { error: 'Database admin not configured' }

    // Fetch refund with booking details
    const { data: refund, error: refundError } = await adminClient
      .from('refunds')
      .select(`
        id, refund_type, status, booking_id, policy_applied,
        booking:bookings (
          id, reservation_code, check_in,
          user_id,
          listing:listings(user_id)
        )
      `)
      .eq('id', refundId)
      .single()

    if (refundError || !refund) return { error: 'Refund not found' }
    if (refund.status !== 'pending') return { error: `Cannot approve: refund status is "${refund.status}"` }

    const booking = refund.booking as any

    // Compute refund amount and booking fees from DB
    const { data: refundAmount } = await adminClient
      .rpc('calc_refund_amount', { p_refund_id: refundId })
      .single() as { data: number | null }

    const { data: fees } = booking
      ? await adminClient.rpc('calc_booking_fees', { p_booking_id: booking.id }).single() as unknown as { data: { total_with_fees: number; host_payout: number } | null }
      : { data: null }

    // Update refund status to approved
    const { error: updateError } = await adminClient
      .from('refunds')
      .update({
        status: 'approved',
        processed_by: user.id,
        processed_at: new Date().toISOString()
      })
      .eq('id', refundId)

    if (updateError) {
      console.error('Error approving refund:', updateError)
      return { error: 'Failed to approve refund' }
    }

    // Handle payout adjustments and create transaction rows
    if (booking) {
      const isFullRefund = fees ? (refundAmount ?? 0) >= fees.total_with_fees : refund.refund_type === 'full'

      // Create refund transaction for guest
      if (refundAmount && refundAmount > 0) {
        await adminClient.from('transactions').insert({
          user_id: booking.user_id,
          type: 'refund' as const,
          amount: refundAmount,
          booking_id: booking.id,
          refund_id: refundId,
          notes: `Refund approved: ${refundAmount} EGP`,
        })
      }

      // For full refund: reverse guest_fee + host transactions
      if (isFullRefund) {
        // Reverse guest_fee
        const { data: guestFeeTx } = await adminClient
          .from('transactions')
          .select('id, amount')
          .eq('booking_id', booking.id)
          .eq('user_id', booking.user_id)
          .eq('type', 'guest_fee')
          .is('reversal_of_id', null)
          .single()

        if (guestFeeTx) {
          await adminClient.from('transactions').insert({
            user_id: booking.user_id,
            type: 'reversal' as const,
            amount: -guestFeeTx.amount,
            booking_id: booking.id,
            reversal_of_id: guestFeeTx.id,
            notes: 'Guest fee reversal (full refund)',
          })
        }

        // Reverse host transactions if host was already paid
        const { data: bookingStatus } = await adminClient
          .from('bookings')
          .select('escrow_status')
          .eq('id', booking.id)
          .single()

        if (bookingStatus?.escrow_status === 'released') {
          const listingData = booking.listing as any
          const hostId = Array.isArray(listingData) ? listingData[0]?.user_id : listingData?.user_id

          if (hostId) {
            const { data: hostTxns } = await adminClient
              .from('transactions')
              .select('id, amount, type')
              .eq('booking_id', booking.id)
              .eq('user_id', hostId)
              .in('type', ['earning', 'commission_base', 'commission_promo'])

            if (hostTxns && hostTxns.length > 0) {
              const reversals = hostTxns.map(tx => ({
                user_id: hostId,
                type: 'reversal' as const,
                amount: -tx.amount,
                booking_id: booking.id,
                reversal_of_id: tx.id,
                notes: `Reversal of ${tx.type} (full refund)`,
              }))
              await adminClient.from('transactions').insert(reversals)
            }
          }
        }

        // Update booking escrow status
        await adminClient
          .from('bookings')
          .update({ escrow_status: 'refunded' })
          .eq('id', booking.id)
      }

      // Update escrow record (type='refund') to completed
      await adminClient
        .from('escrow')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('booking_id', booking.id)
        .eq('type', 'refund')
        .eq('status', 'pending')

      // Notify guest
      const formattedAmount = refundAmount != null
        ? new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(refundAmount)
        : 'your requested amount'

      await adminClient.from('user_notifications').insert({
        user_id: booking.user_id,
        type: 'refund_approved',
        title: 'Refund Approved',
        message: `Your refund of ${formattedAmount} has been approved.`,
        related_entity_id: refundId,
        related_entity_type: 'refund',
        is_read: false
      })
    }

    // Audit log
    await supabase.rpc('create_audit_log', {
      p_action: 'refund.approve',
      p_entity_type: 'refund',
      p_entity_id: refundId,
      p_entity_name: `Refund ${refundId}`,
      p_old_data: { status: 'pending' },
      p_new_data: { status: 'approved', processed_by: user.id },
      p_notes: `Refund of ${refundAmount ?? 'unknown'} EGP approved`
    })

    revalidatePath('/admin/refunds')
    return { success: true }
  } catch (error) {
    console.error('Exception in approveRefund:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function rejectRefund(refundId: string, reason: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Failed to initialize Supabase client' }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'Unauthorized' }

    // Staff check
    const { data: staff } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()

    if (!staff) return { error: 'Insufficient permissions' }

    const adminClient = await createAdminClient()
    if (!adminClient) return { error: 'Database admin not configured' }

    // Fetch refund with booking
    const { data: refund, error: refundError } = await adminClient
      .from('refunds')
      .select(`
        id, status, booking_id,
        booking:bookings(id, user_id)
      `)
      .eq('id', refundId)
      .single()

    if (refundError || !refund) return { error: 'Refund not found' }
    if (refund.status !== 'pending') return { error: `Cannot reject: refund status is "${refund.status}"` }

    // Update refund status
    const { error: updateError } = await adminClient
      .from('refunds')
      .update({
        status: 'rejected',
        processed_by: user.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', refundId)

    if (updateError) {
      console.error('Error rejecting refund:', updateError)
      return { error: 'Failed to reject refund' }
    }

    // Cancel related escrow record
    await adminClient
      .from('escrow')
      .update({ status: 'cancelled' })
      .eq('booking_id', refund.booking_id)
      .eq('type', 'refund')
      .eq('status', 'pending')

    // Notify guest
    const booking = refund.booking as any
    if (booking?.user_id) {
      await adminClient.from('user_notifications').insert({
        user_id: booking.user_id,
        type: 'refund_rejected',
        title: 'Refund Request Rejected',
        message: `Your refund request has been rejected. Reason: ${reason}`,
        related_entity_id: refundId,
        related_entity_type: 'refund',
        is_read: false
      })
    }

    // Audit log
    await supabase.rpc('create_audit_log', {
      p_action: 'refund.reject',
      p_entity_type: 'refund',
      p_entity_id: refundId,
      p_entity_name: `Refund ${refundId}`,
      p_old_data: { status: 'pending' },
      p_new_data: { status: 'rejected', reason },
      p_notes: `Refund rejected: ${reason}`
    })

    revalidatePath('/admin/refunds')
    return { success: true }
  } catch (error) {
    console.error('Exception in rejectRefund:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function processRefund(refundId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Failed to initialize Supabase client' }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'Unauthorized' }

    // Staff check
    const { data: staff } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()

    if (!staff) return { error: 'Insufficient permissions' }

    const adminClient = await createAdminClient()
    if (!adminClient) return { error: 'Database admin not configured' }

    // Verify refund is in approved state
    const { data: refund, error: refundError } = await adminClient
      .from('refunds')
      .select('id, status')
      .eq('id', refundId)
      .single()

    if (refundError || !refund) return { error: 'Refund not found' }
    if (refund.status !== 'approved') return { error: `Cannot process: refund status is "${refund.status}", expected "approved"` }

    const { error: updateError } = await adminClient
      .from('refunds')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', refundId)

    if (updateError) {
      console.error('Error processing refund:', updateError)
      return { error: 'Failed to process refund' }
    }

    // Compute refund amount from the DB for audit log
    const { data: refundAmount } = await adminClient
      .rpc('calc_refund_amount', { p_refund_id: refundId })
      .single() as { data: number | null }

    // Audit log
    await supabase.rpc('create_audit_log', {
      p_action: 'refund.process',
      p_entity_type: 'refund',
      p_entity_id: refundId,
      p_entity_name: `Refund ${refundId}`,
      p_old_data: { status: 'approved' },
      p_new_data: { status: 'processed' },
      p_notes: `Refund of ${refundAmount ?? 'unknown'} EGP marked as processed (money movement complete)`
    })

    revalidatePath('/admin/refunds')
    return { success: true }
  } catch (error) {
    console.error('Exception in processRefund:', error)
    return { error: 'An unexpected error occurred' }
  }
}
