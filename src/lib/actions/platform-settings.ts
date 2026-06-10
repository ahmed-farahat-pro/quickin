'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface CommissionRates {
  id: string
  hostRate: number
  guestRate: number
  bestOfferRate: number
  effective_from: string
  effective_to: string | null
  created_at: string
  notes: string | null
  created_by_name?: string
}

/** Fallback values when the database is unavailable */
const FALLBACK_RATES: CommissionRates = {
  id: '00000000-0000-0000-0000-000000000000',
  hostRate: 0.10,
  guestRate: 0.02,
  bestOfferRate: 0.02,
  effective_from: new Date().toISOString(),
  effective_to: null,
  created_at: new Date().toISOString(),
  notes: 'Fallback rates',
}

/**
 * Reads current commission rates from the commission_rates table
 * via the get_current_commission_rates() Postgres function.
 * Falls back to hard-coded defaults if DB is unavailable.
 */
export async function getCommissionRates(): Promise<CommissionRates> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return FALLBACK_RATES
    }

    const { data, error } = await supabase.rpc('get_current_commission_rates').single()

    if (error || !data) {
      return FALLBACK_RATES
    }

    const rates = data as any
    return {
      id: rates.id || FALLBACK_RATES.id,
      hostRate: typeof rates.host_rate === 'number' ? rates.host_rate : Number(rates.host_rate) || FALLBACK_RATES.hostRate,
      guestRate: typeof rates.guest_rate === 'number' ? rates.guest_rate : Number(rates.guest_rate) || FALLBACK_RATES.guestRate,
      bestOfferRate: typeof rates.best_offer_rate === 'number' ? rates.best_offer_rate : Number(rates.best_offer_rate) || FALLBACK_RATES.bestOfferRate,
      effective_from: rates.effective_from || new Date().toISOString(),
      effective_to: rates.effective_to || null,
      created_at: rates.created_at || new Date().toISOString(),
      notes: rates.notes || null,
    }
  } catch {
    return FALLBACK_RATES
  }
}

/**
 * Fetches the entire commission rate history, ordered by newest first.
 * Includes the name of the staff member who created each record.
 */
export async function getCommissionRateHistory(): Promise<CommissionRates[]> {
  try {
    const supabase = await createClient()
    if (!supabase) return []

    const { data, error } = await supabase
      .from('commission_rates')
      .select(`
        *,
        staff_profiles:created_by (
          display_name
        )
      `)
      .order('effective_from', { ascending: false })

    if (error || !data) {
      console.error('Error fetching commission history:', error)
      return []
    }

    return (data as any[]).map(row => ({
      id: row.id,
      hostRate: Number(row.host_rate),
      guestRate: Number(row.guest_rate),
      bestOfferRate: Number(row.best_offer_rate),
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      created_at: row.created_at,
      notes: row.notes,
      created_by_name: row.staff_profiles?.display_name || 'System',
    }))
  } catch (err) {
    console.error('getCommissionRateHistory failed:', err)
    return []
  }
}

/**
 * Updates commission rates atomically via the update_commission_rates()
 * Postgres function. Admin-only. Logs to audit_logs for traceability.
 */
export async function updateCommissionRates(hostRate: number, guestRate: number, bestOfferRate: number = 0.02) {
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

  // Validate rates (DB CHECK constraints also enforce >= 0 AND < 1)
  if (hostRate < 0 || hostRate > 1 || guestRate < 0 || guestRate > 1 || bestOfferRate < 0 || bestOfferRate > 1) {
    return { error: 'Commission rates must be between 0 and 1 (0% to 100%)' }
  }

  // Get old values for audit
  const oldRates = await getCommissionRates()

  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  // Atomically close old row and insert new via Postgres function
  const { error: updateError } = await adminClient.rpc('update_commission_rates', {
    p_host_rate: hostRate,
    p_guest_rate: guestRate,
    p_best_offer_rate: bestOfferRate,
    p_created_by: user.id,
    p_notes: `Commission rates updated: Host ${oldRates.hostRate * 100}% → ${hostRate * 100}%, Guest ${oldRates.guestRate * 100}% → ${guestRate * 100}%, Best Offer ${oldRates.bestOfferRate * 100}% → ${bestOfferRate * 100}%`,
  })

  if (updateError) {
    console.error('Error updating commission rates:', updateError)
    return { error: 'Failed to update commission rates' }
  }

  // Audit log
  await supabase.rpc('create_audit_log', {
    p_action: 'commission.update',
    p_entity_type: 'commission',
    p_entity_id: null,
    p_entity_name: 'Platform Commission Rates',
    p_old_data: { host_rate: oldRates.hostRate, guest_rate: oldRates.guestRate, best_offer_rate: oldRates.bestOfferRate },
    p_new_data: { host_rate: hostRate, guest_rate: guestRate, best_offer_rate: bestOfferRate },
    p_notes: `Commission rates updated: Host ${oldRates.hostRate * 100}% → ${hostRate * 100}%, Guest ${oldRates.guestRate * 100}% → ${guestRate * 100}%, Best Offer ${oldRates.bestOfferRate * 100}% → ${bestOfferRate * 100}%`
  })

  return { success: true }
}
