'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface HostPaymentMethod {
  id: string
  user_id: string
  type: 'mobile_wallet' | 'bank_account' | 'instapay'
  provider_name: string | null
  account_number: string
  account_holder_name: string
  bank_name: string | null
  iban: string | null
  swift_code: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export async function getHostPaymentMethods() {
  const supabase = await createClient()
  if (!supabase) return []

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('host_payment_methods')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching payment methods:', error.message || error)
    return []
  }

  return (data || []) as HostPaymentMethod[]
}

export async function getMobileWallets() {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('mobile_wallets')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('Error fetching mobile wallets:', error.message || error)
    return []
  }

  return data || []
}

export async function saveHostPaymentMethod(method: Partial<HostPaymentMethod>) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const dataToSave = {
    ...method,
    user_id: user.id,
  }

  const { error } = await supabase
    .from('host_payment_methods')
    .upsert(dataToSave)

  if (error) {
    console.error('Error saving payment method:', error)
    return { error: 'Failed to save payment method' }
  }

  revalidatePath('/dashboard/balance')
  return { success: true }
}

export async function deleteHostPaymentMethod(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('host_payment_methods')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting payment method:', error)
    return { error: 'Failed to delete payment method' }
  }

  revalidatePath('/dashboard/balance')
  return { success: true }
}

export async function setHostDefaultPaymentMethod(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('host_payment_methods')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error setting default payment method:', error)
    return { error: 'Failed to set default payment method' }
  }

  revalidatePath('/dashboard/balance')
  return { success: true }
}
