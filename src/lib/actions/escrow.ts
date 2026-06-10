'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendFCMNotification } from './notifications'

interface BookingFees {
  subtotal: number
  guest_fee: number
  host_fee: number
  platform_earnings: number
  host_payout: number
  total_with_fees: number
}

/**
 * Creates an escrow "hold" record when a payment is approved.
 * Creates payment + guest_fee transaction rows in the ledger.
 * Escrow table is audit-only (no amounts).
 */
export async function createEscrowHold(bookingId: string) {
  const adminClient = await createAdminClient()
  if (!adminClient) throw new Error('Database admin not configured')

  const supabase = await createClient()
  if (!supabase) throw new Error('Auth client not configured')

  const { data: { user } } = await supabase.auth.getUser()
  const initiatedBy = user?.id || null

  // Check if already held to prevent double increment
  const { data: currentBooking } = await adminClient
    .from('bookings')
    .select('id, escrow_status, user_id')
    .eq('id', bookingId)
    .single()

  if (currentBooking?.escrow_status === 'held') {
    return { success: true, message: 'Already held' }
  }

  // Get computed fee breakdown
  const { data: fees } = await adminClient.rpc('calc_booking_fees', { p_booking_id: bookingId }).single() as unknown as { data: BookingFees | null }
  if (!fees) throw new Error('Failed to compute booking fees')

  const guestId = currentBooking!.user_id

  // Create transaction rows (the ledger entries)
  const { error: txError } = await adminClient
    .from('transactions')
    .insert([
      {
        user_id: guestId,
        type: 'payment' as const,
        amount: -fees.subtotal,
        booking_id: bookingId,
        balance_impact: false,
        notes: 'Payment for booking',
      },
      {
        user_id: guestId,
        type: 'guest_fee' as const,
        amount: -fees.guest_fee,
        booking_id: bookingId,
        balance_impact: false,
        notes: 'Platform service fee',
      },
    ])

  if (txError) {
    console.error('Error creating payment transactions:', txError)
    return { error: 'Failed to create payment transactions' }
  }

  // Create escrow audit record (no amount)
  const { data: escrow, error: escrowError } = await adminClient
    .from('escrow')
    .insert({
      booking_id: bookingId,
      type: 'hold',
      status: 'completed',
      initiated_by: initiatedBy,
      completed_at: new Date().toISOString(),
      notes: 'Funds held upon payment approval',
    })
    .select('id')
    .single()

  if (escrowError) {
    console.error('Error creating escrow hold:', escrowError)
    return { error: 'Failed to create escrow hold' }
  }

  // Update booking escrow status
  await adminClient
    .from('bookings')
    .update({ escrow_status: 'held' })
    .eq('id', bookingId)

  // Audit log
  await supabase.rpc('create_audit_log', {
    p_action: 'escrow.hold',
    p_entity_type: 'escrow',
    p_entity_id: escrow.id,
    p_entity_name: `Escrow hold for booking`,
    p_new_data: { booking_id: bookingId, total_with_fees: fees.total_with_fees, status: 'completed' },
    p_notes: `Funds held: ${fees.total_with_fees} EGP`
  })

  return { success: true, escrowId: escrow.id }
}

/**
 * Releases escrowed funds to the host.
 * Creates earning + commission transaction rows in the ledger.
 */
export async function releaseEscrow(bookingId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify staff
  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staff) return { error: 'Unauthorized: staff only' }

  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  // Get booking info
  const { data: booking, error: bookingError } = await adminClient
    .from('bookings')
    .select(`
      id, best_offer_subtotal, escrow_status, is_check_in_confirmed, user_id,
      commission_rates:commission_rates(best_offer_rate),
      listing:listings(user_id, title)
    `)
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return { error: 'Booking not found' }
  }

  if (booking.escrow_status !== 'held') {
    return { error: `Cannot release escrow: current status is "${booking.escrow_status}"` }
  }

  if (!booking.is_check_in_confirmed) {
    return { error: `Cannot release funds: Guest has not confirmed check-in yet.` }
  }

  const listingData = booking.listing as unknown as { user_id: string; title: string } | { user_id: string; title: string }[]
  const hostId = Array.isArray(listingData) ? listingData[0]?.user_id : listingData?.user_id
  const listingTitle = Array.isArray(listingData) ? listingData[0]?.title : listingData?.title

  if (!hostId) {
    return { error: 'Could not determine host for this booking' }
  }

  // Get computed fee breakdown
  const { data: fees } = await adminClient.rpc('calc_booking_fees', { p_booking_id: bookingId }).single() as unknown as { data: BookingFees | null }
  if (!fees) return { error: 'Failed to compute booking fees' }

  const rates = Array.isArray(booking.commission_rates) ? booking.commission_rates[0] : booking.commission_rates
  const bestOfferRate = Number(rates?.best_offer_rate ?? 0)
  const bestOfferSubtotal = Number(booking.best_offer_subtotal ?? 0)
  const promoFee = bestOfferSubtotal > 0 && bestOfferRate > 0 ? Math.round(bestOfferSubtotal * bestOfferRate) : 0
  const payoutAmount = fees.subtotal - fees.host_fee - promoFee

  // Create transaction rows for host earning + commission
  const txRows: Array<{
    user_id: string
    type: 'earning' | 'commission_base' | 'commission_promo'
    amount: number
    booking_id: string
    notes: string
  }> = [
    {
      user_id: hostId,
      type: 'earning',
      amount: fees.subtotal,
      booking_id: bookingId,
      notes: 'Booking payout (subtotal)',
    },
    {
      user_id: hostId,
      type: 'commission_base',
      amount: -fees.host_fee,
      booking_id: bookingId,
      notes: `Platform commission (${Math.round((fees.host_fee / fees.subtotal) * 100)}%)`,
    },
  ]

  if (promoFee > 0) {
    txRows.push({
      user_id: hostId,
      type: 'commission_promo',
      amount: -promoFee,
      booking_id: bookingId,
      notes: `Best offer commission (${Math.round(bestOfferRate * 100)}%)`,
    })
  }

  const { error: txError } = await adminClient.from('transactions').insert(txRows)
  if (txError) {
    console.error('Error creating release transactions:', txError)
    return { error: 'Failed to create release transactions' }
  }

  // Create escrow audit record (no amount)
  const { data: escrow, error: escrowError } = await adminClient
    .from('escrow')
    .insert({
      booking_id: bookingId,
      type: 'release',
      status: 'completed',
      initiated_by: user.id,
      completed_at: new Date().toISOString(),
      notes: `Funds released to host. Payout: ${payoutAmount} EGP`,
    })
    .select('id')
    .single()

  if (escrowError) {
    console.error('Error creating escrow release:', escrowError)
    return { error: 'Failed to release escrow' }
  }

  // Update booking escrow status
  await adminClient
    .from('bookings')
    .update({ escrow_status: 'released' })
    .eq('id', bookingId)

  // Audit log
  await supabase.rpc('create_audit_log', {
    p_action: 'escrow.release',
    p_entity_type: 'escrow',
    p_entity_id: escrow.id,
    p_entity_name: `Escrow release for booking`,
    p_new_data: {
      booking_id: bookingId,
      host_id: hostId,
      payout_amount: payoutAmount,
      commission_base: fees.host_fee,
      commission_promo: promoFee,
    },
    p_notes: `Funds released to host: ${payoutAmount} EGP (commission: ${fees.host_fee + promoFee} EGP)`
  })

  // Notify host
  const title = 'Funds Released'
  const message = `The funds for your booking at ${listingTitle || 'your listing'} have been released to your platform balance.`

  await adminClient.from('user_notifications').insert({
      user_id: hostId,
      type: 'escrow_released',
      title,
      message,
      related_entity_id: bookingId,
      related_entity_type: 'booking'
  })

  const { data: hostProfile } = await adminClient.from('profiles').select('fcm_token').eq('id', hostId).single()
  if (hostProfile?.fcm_token) {
      sendFCMNotification([hostProfile.fcm_token], title, message, {
          type: 'balance_update',
          bookingId
      }).catch(console.error)
  }

  revalidatePath('/admin/financials')
  revalidatePath('/admin/payouts')
  return { success: true }
}

/**
 * Refunds escrowed funds (full or partial) back to guest balance.
 * Creates refund + reversal transaction rows in the ledger.
 */
export async function refundEscrow(
  bookingId: string,
  refundAmount: number,
  reason: string,
  refundType: 'full' | 'partial',
  policyApplied?: string,
  refundId?: string,
) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify staff
  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staff) return { error: 'Unauthorized: staff only' }

  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  // Get booking
  const { data: booking } = await adminClient
    .from('bookings')
    .select('id, user_id, escrow_status, listing:listings(user_id)')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Booking not found' }
  if (booking.escrow_status !== 'held' && booking.escrow_status !== 'released') {
    return { error: `Cannot refund: escrow status is "${booking.escrow_status}"` }
  }

  // Get computed fee breakdown for validation
  const { data: fees } = await adminClient.rpc('calc_booking_fees', { p_booking_id: bookingId }).single() as unknown as { data: BookingFees | null }
  if (!fees) return { error: 'Failed to compute booking fees' }

  if (refundAmount > fees.total_with_fees) {
    return { error: 'Refund amount cannot exceed total booking price' }
  }

  // Create refund record if not provided
  let actualRefundId = refundId
  if (!actualRefundId) {
    const { data: refund } = await adminClient
      .from('refunds')
      .insert({
        booking_id: bookingId,
        reason,
        refund_type: refundType,
        policy_applied: policyApplied || null,
        status: 'processed',
        initiated_by: user.id,
        processed_by: user.id,
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    actualRefundId = refund?.id
  }

  // Create refund transaction for guest
  await adminClient.from('transactions').insert({
    user_id: booking.user_id,
    type: 'refund' as const,
    amount: refundAmount,
    booking_id: bookingId,
    refund_id: actualRefundId,
    notes: `Refund for booking: ${reason}`,
  })

  // For full refund: also reverse guest_fee
  if (refundType === 'full') {
    // Find the original guest_fee transaction
    const { data: guestFeeTx } = await adminClient
      .from('transactions')
      .select('id, amount')
      .eq('booking_id', bookingId)
      .eq('user_id', booking.user_id)
      .eq('type', 'guest_fee')
      .is('reversal_of_id', null)
      .single()

    if (guestFeeTx) {
      await adminClient.from('transactions').insert({
        user_id: booking.user_id,
        type: 'reversal' as const,
        amount: -guestFeeTx.amount,
        booking_id: bookingId,
        reversal_of_id: guestFeeTx.id,
        notes: 'Guest fee reversal (full refund)',
      })
    }
  }

  // If host was already paid (escrow released), reverse host transactions
  if (booking.escrow_status === 'released' && refundType === 'full') {
    const listingData = booking.listing as unknown as { user_id: string } | { user_id: string }[]
    const hostId = Array.isArray(listingData) ? listingData[0]?.user_id : listingData?.user_id

    if (hostId) {
      // Find all host transactions for this booking (earning, commission_base, commission_promo)
      const { data: hostTxns } = await adminClient
        .from('transactions')
        .select('id, amount, type')
        .eq('booking_id', bookingId)
        .eq('user_id', hostId)
        .in('type', ['earning', 'commission_base', 'commission_promo'])

      // Create a reversal for each
      if (hostTxns && hostTxns.length > 0) {
        const reversals = hostTxns.map(tx => ({
          user_id: hostId,
          type: 'reversal' as const,
          amount: -tx.amount,
          booking_id: bookingId,
          reversal_of_id: tx.id,
          notes: `Reversal of ${tx.type} (full refund)`,
        }))
        await adminClient.from('transactions').insert(reversals)
      }
    }
  }

  // Create escrow audit record (no amount)
  const { data: escrow } = await adminClient
    .from('escrow')
    .insert({
      booking_id: bookingId,
      type: 'refund',
      status: 'completed',
      initiated_by: user.id,
      completed_at: new Date().toISOString(),
      notes: `Refund: ${reason}`,
    })
    .select('id')
    .single()

  // Update booking
  const newEscrowStatus = refundType === 'full' ? 'refunded' : 'held'
  await adminClient
    .from('bookings')
    .update({
      escrow_status: newEscrowStatus,
      status: refundType === 'full' ? 'cancelled' : 'confirmed',
    })
    .eq('id', bookingId)

  // Audit log
  await supabase.rpc('create_audit_log', {
    p_action: 'escrow.refund',
    p_entity_type: 'escrow',
    p_entity_id: escrow?.id || null,
    p_entity_name: `Escrow refund for booking`,
    p_new_data: {
      booking_id: bookingId,
      guest_id: booking.user_id,
      amount: refundAmount,
      refund_type: refundType,
      policy_applied: policyApplied,
      reason,
    },
    p_notes: `${refundType} refund: ${refundAmount} EGP — ${reason}`
  })

  // Notify guest
  const title = 'Refund Processed'
  const message = `A ${refundType} refund of ${refundAmount} EGP has been added to your platform balance. Reason: ${reason}`

  await adminClient.from('user_notifications').insert({
      user_id: booking.user_id,
      type: 'refund_processed',
      title,
      message,
      related_entity_id: actualRefundId || bookingId,
      related_entity_type: 'refund'
  })

  const { data: guestProfile } = await adminClient.from('profiles').select('fcm_token').eq('id', booking.user_id).single()
  if (guestProfile?.fcm_token) {
      sendFCMNotification([guestProfile.fcm_token], title, message, {
          type: 'balance_update',
          bookingId
      }).catch(console.error)
  }

  revalidatePath('/admin/financials')
  revalidatePath('/admin/refunds')
  return { success: true }
}

/**
 * System-initiated release of escrowed funds to the host (e.g. via Cron job).
 * Identical to releaseEscrow but bypasses the active user / staff check.
 */
export async function systemReleaseEscrow(bookingId: string) {
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  // Get booking info
  const { data: booking, error: bookingError } = await adminClient
    .from('bookings')
    .select(`
      id, best_offer_subtotal, escrow_status, is_check_in_confirmed, user_id,
      commission_rates:commission_rates(best_offer_rate),
      listing:listings(user_id, title)
    `)
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return { error: 'Booking not found' }
  }

  if (booking.escrow_status !== 'held') {
    return { error: `Cannot release escrow: current status is "${booking.escrow_status}"` }
  }

  const listingData = booking.listing as any
  const hostId = Array.isArray(listingData) ? listingData[0]?.user_id : listingData?.user_id
  const listingTitle = Array.isArray(listingData) ? listingData[0]?.title : listingData?.title

  if (!hostId) {
    return { error: 'Could not determine host for this booking' }
  }

  // Get computed fee breakdown
  const { data: fees } = await adminClient.rpc('calc_booking_fees', { p_booking_id: bookingId }).single() as unknown as { data: BookingFees | null }
  if (!fees) return { error: 'Failed to compute booking fees' }

  const rates = Array.isArray(booking.commission_rates) ? booking.commission_rates[0] : booking.commission_rates
  const bestOfferRate = Number(rates?.best_offer_rate ?? 0)
  const bestOfferSubtotal = Number(booking.best_offer_subtotal ?? 0)
  const promoFee = bestOfferSubtotal > 0 && bestOfferRate > 0 ? Math.round(bestOfferSubtotal * bestOfferRate) : 0
  const payoutAmount = fees.subtotal - fees.host_fee - promoFee

  // Create transaction rows for host earning + commission
  const txRows: Array<{
    user_id: string
    type: 'earning' | 'commission_base' | 'commission_promo'
    amount: number
    booking_id: string
    notes: string
  }> = [
    {
      user_id: hostId,
      type: 'earning',
      amount: fees.subtotal,
      booking_id: bookingId,
      notes: 'Booking payout (subtotal)',
    },
    {
      user_id: hostId,
      type: 'commission_base',
      amount: -fees.host_fee,
      booking_id: bookingId,
      notes: `Platform commission (${Math.round((fees.host_fee / fees.subtotal) * 100)}%)`,
    },
  ]

  if (promoFee > 0) {
    txRows.push({
      user_id: hostId,
      type: 'commission_promo',
      amount: -promoFee,
      booking_id: bookingId,
      notes: `Best offer commission (${Math.round(bestOfferRate * 100)}%)`,
    })
  }

  const { error: txError } = await adminClient.from('transactions').insert(txRows)
  if (txError) {
    console.error('Error creating release transactions (system):', txError)
    return { error: 'Failed to create release transactions' }
  }

  // Create escrow audit record (no amount)
  const { data: escrow, error: escrowError } = await adminClient
    .from('escrow')
    .insert({
      booking_id: bookingId,
      type: 'release',
      status: 'completed',
      initiated_by: null,
      completed_at: new Date().toISOString(),
      notes: `Funds auto-released to host (Cron). Payout: ${payoutAmount} EGP`,
    })
    .select('id')
    .single()

  if (escrowError) {
    console.error('Error creating escrow release (system):', escrowError)
    return { error: 'Failed to release escrow' }
  }

  // Update booking escrow status
  await adminClient
    .from('bookings')
    .update({ escrow_status: 'released' })
    .eq('id', bookingId)

  // Audit log
  await adminClient.rpc('create_audit_log', {
    p_action: 'cron.escrow_release',
    p_entity_type: 'escrow',
    p_entity_id: escrow.id,
    p_entity_name: `System Escrow release for booking`,
    p_new_data: {
      booking_id: bookingId,
      host_id: hostId,
      payout_amount: payoutAmount,
      commission_base: fees.host_fee,
      commission_promo: promoFee,
    },
    p_notes: `Funds auto-released to host: ${payoutAmount} EGP (commission: ${fees.host_fee + promoFee} EGP)`
  })

  // Notify host
  const title = 'Funds Auto-Released'
  const message = `The funds for your booking at ${listingTitle || 'your listing'} have been automatically released to your platform balance.`

  await adminClient.from('user_notifications').insert({
      user_id: hostId,
      type: 'escrow_released',
      title,
      message,
      related_entity_id: bookingId,
      related_entity_type: 'booking'
  })

  const { data: hostProfile } = await adminClient.from('profiles').select('fcm_token').eq('id', hostId).single()
  if (hostProfile?.fcm_token) {
      sendFCMNotification([hostProfile.fcm_token], title, message, {
          type: 'balance_update',
          bookingId
      }).catch(console.error)
  }

  return { success: true }
}
