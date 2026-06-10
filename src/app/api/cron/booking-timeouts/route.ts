import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getBookingTimeouts } from '@/lib/actions/booking-settings'
import { systemReleaseEscrow } from '@/lib/actions/escrow'

/**
 * Basic cron endpoint. Suggest using a secret token header in Vercel to secure this.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  
  // NOTE: You should configure an env var in your hosting provider to match this
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = await createAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
  }

  try {
    const { autoCompleteDays, autoCancelDays } = await getBookingTimeouts()

    // 1. Auto-Complete Confirmed Bookings
    // If a booking is confirmed, and its check_out date + autoCompleteDays is in the past, it should be completed and funds released.
    const now = new Date()
    
    // We calculate the threshold date for autocomplete.
    // If check_out was earlier than this threshold, it is time to complete it.
    const autoCompleteThreshold = new Date(now.getTime() - (autoCompleteDays * 24 * 60 * 60 * 1000))
    const autoCompleteThresholdStr = autoCompleteThreshold.toISOString()

    const { data: bookingsToComplete, error: completeFetchError } = await adminClient
      .from('bookings')
      .select('id, escrow_status')
      .eq('status', 'active')
      .lt('check_out', autoCompleteThresholdStr)
    
    if (completeFetchError) throw completeFetchError

    let completedCount = 0
    let failedCompleteCount = 0

    for (const booking of bookingsToComplete || []) {
      if (booking.escrow_status === 'held') {
        const result = await systemReleaseEscrow(booking.id)
        if (result.success) {
          completedCount++
        } else {
          console.error(`Failed to auto-complete booking ${booking.id}:`, result.error)
          failedCompleteCount++
        }
      } else {
        // If it was confirmed but escrow somehow wasn't held, we'll softly mark it completed anyway to clean it up
        await adminClient.from('bookings').update({ status: 'completed' }).eq('id', booking.id)
        completedCount++
      }
    }

    // 2. Auto-Cancel Pending Bookings
    // If a booking is pending, and its created_at + autoCancelDays is in the past, it should be cancelled.
    const autoCancelThreshold = new Date(now.getTime() - (autoCancelDays * 24 * 60 * 60 * 1000))
    const autoCancelThresholdStr = autoCancelThreshold.toISOString()

    const { data: bookingsToCancel, error: cancelFetchError } = await adminClient
      .from('bookings')
      .select('id')
      .eq('status', 'pending')
      .lt('created_at', autoCancelThresholdStr)

    if (cancelFetchError) throw cancelFetchError

    let cancelledCount = 0

    if (bookingsToCancel && bookingsToCancel.length > 0) {
      const cancelIds = bookingsToCancel.map(b => b.id)
      
      const { error: cancelUpdateError } = await adminClient
        .from('bookings')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .in('id', cancelIds)

      if (cancelUpdateError) {
        console.error('Failed to auto-cancel bookings:', cancelUpdateError)
      } else {
        cancelledCount = cancelIds.length
        
        // Audit log for mass cancellation
        await adminClient.rpc('create_audit_log', {
          p_action: 'cron.auto_cancel',
          p_entity_type: 'booking',
          p_entity_id: null,
          p_entity_name: `Batch Cancellation`,
          p_old_data: null,
          p_new_data: { cancelled_count: cancelledCount },
          p_notes: `System auto-cancelled ${cancelledCount} pending bookings due to timeout (${autoCancelDays} days)`
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      results: {
        completed: completedCount,
        failed_completions: failedCompleteCount,
        cancelled: cancelledCount
      } 
    })

  } catch (error) {
    console.error('Error in cron booking timeouts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
