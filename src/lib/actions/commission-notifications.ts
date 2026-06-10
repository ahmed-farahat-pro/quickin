'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendFCMNotification } from '@/lib/actions/notifications'

/**
 * Notifies all hosts (users with ≥1 listing) about a commission rate change.
 * Sends both DB notification + FCM push.
 */
export async function notifyHostsOfCommissionChange(
  newHostRate: number,
  newGuestRate: number,
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

  // Get all hosts (users who have at least 1 listing)
  const { data: hostIds } = await adminClient
    .from('listings')
    .select('user_id')

  const uniqueHostIds = [...new Set((hostIds || []).map(l => l.user_id))]

  if (uniqueHostIds.length === 0) {
    return { success: true, notified: 0 }
  }

  const title = 'Commission Rates Updated'
  const message = `Platform commission rates have been updated. Host commission: ${(newHostRate * 100).toFixed(0)}%, Guest service fee: ${(newGuestRate * 100).toFixed(0)}%. These rates apply to new bookings.`

  // Insert DB notifications for all hosts
  const notifications = uniqueHostIds.map(hostId => ({
    user_id: hostId,
    type: 'commission_change',
    title,
    message,
    related_entity_type: 'commission',
  }))

  await adminClient.from('user_notifications').insert(notifications)

  // Get FCM tokens for all hosts
  const { data: hostProfiles } = await adminClient
    .from('profiles')
    .select('fcm_token')
    .in('id', uniqueHostIds)
    .not('fcm_token', 'is', null)

  const tokens = (hostProfiles || [])
    .map(p => p.fcm_token)
    .filter(Boolean) as string[]

  if (tokens.length > 0) {
    sendFCMNotification(tokens, title, message, {
      type: 'commission_change',
    }).catch(console.error)
  }

  // Audit log
  await supabase.rpc('create_audit_log', {
    p_action: 'commission.notify_hosts',
    p_entity_type: 'commission',
    p_entity_id: null,
    p_entity_name: 'Commission Change Notification',
    p_new_data: {
      host_rate: newHostRate,
      guest_rate: newGuestRate,
      hosts_notified: uniqueHostIds.length,
    },
    p_notes: `Notified ${uniqueHostIds.length} hosts about commission rate change`
  })

  revalidatePath('/admin/settings/commissions')
  return { success: true, notified: uniqueHostIds.length }
}
