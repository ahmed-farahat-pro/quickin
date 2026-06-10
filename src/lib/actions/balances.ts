'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface UserBalance {
  available_balance: number
  on_hold_balance: number
  total_earned: number
}

/**
 * Gets balance for a specific user.
 */
export async function getUserBalance(userId: string): Promise<UserBalance> {
  const supabase = await createClient()
  if (!supabase) return { available_balance: 0, on_hold_balance: 0, total_earned: 0 }

  const { data } = await supabase
    .rpc('get_user_balance', { p_user_id: userId })
    .single() as { data: UserBalance | null }

  return data || { available_balance: 0, on_hold_balance: 0, total_earned: 0 }
}

/**
 * Gets transactions for a user, newest first.
 */
export async function getBalanceTransactions(userId: string, limit = 50) {
  const supabase = await createClient()
  if (!supabase) return []

  const { data: balanceData } = await supabase
    .rpc('get_user_balance', { p_user_id: userId })
    .single() as { data: UserBalance | null }

  let runningBalance = balanceData?.available_balance ?? 0

  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  const rows = data || []

  return rows.map((tx: any) => {
    const balanceAfter = runningBalance
    if (tx?.balance_impact !== false) {
      runningBalance = runningBalance - Number(tx.amount || 0)
    }
    return { ...tx, balance_after: balanceAfter }
  })
}

/**
 * Host requests a withdrawal from available balance.
 * Creates a payout record first, then a withdrawal transaction.
 */
export async function requestWithdrawal(amount: number, methodId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  // 1. Get payment method details
  const { data: methodData, error: methodError } = await adminClient
    .from('host_payment_methods')
    .select('*')
    .eq('id', methodId)
    .single()

  if (methodError || !methodData) {
    return { error: 'Invalid payment method selected' }
  }

  // Check balance using computed RPC
  const { data: balance } = await adminClient
    .rpc('get_user_balance', { p_user_id: user.id })
    .single() as { data: UserBalance | null }

  if (!balance || balance.available_balance < amount) {
    return { error: 'Insufficient available balance' }
  }

  if (amount <= 0) {
    return { error: 'Withdrawal amount must be positive' }
  }

  // 2. Map type to legacy payout_method if needed
  const legacyMethod = methodData.type === 'bank_account' ? 'bank_transfer' : 
                       methodData.type === 'mobile_wallet' ? 'mobile_wallet' : methodData.type;

  // 3. Create payout record FIRST
  const { data: payout, error: payoutError } = await adminClient
    .from('payouts')
    .insert({
      host_id: user.id,
      status: 'pending',
      payout_method: legacyMethod,
      payment_method_id: methodId,
      payment_method_details: methodData,
      notes: `Host requested withdrawal: ${amount} EGP via ${methodData.provider_name || methodData.type} (${methodData.account_number})`,
    })
    .select('id')
    .single()

  if (payoutError) {
    console.error('Error creating payout:', payoutError)
    return { error: 'Failed to create withdrawal request' }
  }

  // 4. Create withdrawal transaction with payout_id
  const { error: txError } = await adminClient
    .from('transactions')
    .insert({
      user_id: user.id,
      type: 'withdrawal' as const,
      amount: -amount,
      payout_id: payout.id,
      notes: `Withdrawal request via ${methodData.provider_name || methodData.type}`,
    })

  if (txError) {
    // Rollback: delete the payout
    await adminClient
      .from('payouts')
      .delete()
      .eq('id', payout.id)
    console.error('Error creating withdrawal transaction:', txError)
    return { error: 'Failed to create withdrawal request' }
  }

  // 5. Audit log
  await supabase.rpc('create_audit_log', {
    p_action: 'balance.withdrawal_request',
    p_entity_type: 'withdrawal',
    p_entity_id: payout.id,
    p_entity_name: 'Withdrawal Request',
    p_new_data: { amount, methodId, methodData },
    p_notes: `Host requested withdrawal: ${amount} EGP via ${methodData.provider_name || methodData.type}`
  })

  revalidatePath('/dashboard/balance')
  return { success: true }
}
