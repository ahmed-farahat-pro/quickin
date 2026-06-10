'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_AUTO_COMPLETE_DAYS, DEFAULT_AUTO_CANCEL_DAYS } from '@/lib/constants'

export interface BookingTimeouts {
  autoCompleteDays: number
  autoCancelDays: number
}

/**
 * Reads booking timeout settings from platform_settings table.
 * Falls back to constants if DB is unavailable.
 */
export async function getBookingTimeouts(): Promise<BookingTimeouts> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return { autoCompleteDays: DEFAULT_AUTO_COMPLETE_DAYS, autoCancelDays: DEFAULT_AUTO_CANCEL_DAYS }
    }

    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['auto_complete_days', 'auto_cancel_days'])

    const completeSetting = settings?.find(s => s.key === 'auto_complete_days')
    const cancelSetting = settings?.find(s => s.key === 'auto_cancel_days')

    return {
      autoCompleteDays: completeSetting ? parseInt(completeSetting.value, 10) : DEFAULT_AUTO_COMPLETE_DAYS,
      autoCancelDays: cancelSetting ? parseInt(cancelSetting.value, 10) : DEFAULT_AUTO_CANCEL_DAYS,
    }
  } catch {
    return { autoCompleteDays: DEFAULT_AUTO_COMPLETE_DAYS, autoCancelDays: DEFAULT_AUTO_CANCEL_DAYS }
  }
}

/**
 * Updates booking timeout logic. Admin-only.
 * Logs to audit_logs for traceability.
 */
export async function updateBookingTimeouts(autoCompleteDays: number, autoCancelDays: number) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify staff
  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('id, role')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staff) return { error: 'Unauthorized: staff only' }

  // Validate inputs
  if (autoCompleteDays < 1 || autoCompleteDays > 30 || autoCancelDays < 1 || autoCancelDays > 30) {
    return { error: 'Timeouts must be between 1 and 30 days' }
  }

  const oldTimeouts = await getBookingTimeouts()
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  // Update auto complete days
  const { error: completeError } = await adminClient
    .from('platform_settings')
    .upsert({
      key: 'auto_complete_days',
      value: autoCompleteDays.toString(),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })

  if (completeError) {
    console.error('Error updating auto_complete_days:', completeError)
    return { error: 'Failed to update auto complete check-out setting' }
  }

  // Update auto cancel days
  const { error: cancelError } = await adminClient
    .from('platform_settings')
    .upsert({
      key: 'auto_cancel_days',
      value: autoCancelDays.toString(),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })

  if (cancelError) {
    console.error('Error updating auto_cancel_days:', cancelError)
    return { error: 'Failed to update auto cancel setting' }
  }

  // Audit log
  await supabase.rpc('create_audit_log', {
    p_action: 'settings.booking_timeouts_update',
    p_entity_type: 'settings',
    p_entity_id: null,
    p_entity_name: 'Booking Timeout Settings',
    p_old_data: { auto_complete_days: oldTimeouts.autoCompleteDays, auto_cancel_days: oldTimeouts.autoCancelDays },
    p_new_data: { auto_complete_days: autoCompleteDays, auto_cancel_days: autoCancelDays },
    p_notes: `Timeouts updated: Auto-complete ${oldTimeouts.autoCompleteDays}d → ${autoCompleteDays}d, Auto-cancel ${oldTimeouts.autoCancelDays}d → ${autoCancelDays}d`
  })

  return { success: true }
}
