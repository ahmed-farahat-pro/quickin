'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deletePolicy(code: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get before deleting
  const { data: policy } = await supabase.from('cancellation_policies').select('*').eq('code', code).single()

  const { error } = await supabase.from('cancellation_policies').delete().eq('code', code)

  if (error) {
    console.error('Error deleting policy:', error)
    if (error.code === '23503') {
      return { error: 'This cancellation policy is currently in use by one or more listings. Please disable it instead.' }
    }
    return { error: error.message }
  }

  if (policy) {
    await supabase.rpc('create_audit_log', {
      p_action: 'policy.delete',
      p_entity_type: 'cancellation_policy',
      p_entity_id: code,
      p_entity_name: policy.label,
      p_old_data: policy,
      p_notes: 'Deleted via admin panel'
    })
  }

  revalidatePath('/admin/cancellation-policies')
  return { success: true }
}

export async function togglePolicyEnabled(code: string, is_enabled: boolean, label: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('cancellation_policies').update({ is_enabled }).eq('code', code)

  if (error) return { error: error.message }

  await supabase.rpc('create_audit_log', {
    p_action: is_enabled ? 'policy.enable' : 'policy.disable',
    p_entity_type: 'cancellation_policy',
    p_entity_id: code,
    p_entity_name: label,
    p_new_data: { is_enabled },
    p_notes: 'Status toggled via admin panel'
  })

  revalidatePath('/admin/cancellation-policies')
  return { success: true }
}

export async function createPolicy(data: any) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: newPolicy, error } = await supabase
    .from('cancellation_policies')
    .insert([data])
    .select()
    .single()

  if (error) {
    console.error('Error creating policy:', error)
    return { error: error.message }
  }

  await supabase.rpc('create_audit_log', {
    p_action: 'policy.create',
    p_entity_type: 'cancellation_policy',
    p_entity_id: newPolicy.code,
    p_entity_name: newPolicy.label,
    p_new_data: newPolicy,
    p_notes: 'Created via admin panel'
  })

  revalidatePath('/admin/cancellation-policies')
  return { success: true, policy: newPolicy }
}

export async function updatePolicy(code: string, data: any) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: oldPolicy } = await supabase.from('cancellation_policies').select('*').eq('code', code).single()

  const { data: updatedPolicy, error } = await supabase
    .from('cancellation_policies')
    .update(data)
    .eq('code', code)
    .select()
    .single()

  if (error) {
    console.error('Error updating policy:', error)
    return { error: error.message }
  }

  await supabase.rpc('create_audit_log', {
    p_action: 'policy.update',
    p_entity_type: 'cancellation_policy',
    p_entity_id: code,
    p_entity_name: updatedPolicy.label,
    p_old_data: oldPolicy,
    p_new_data: updatedPolicy,
    p_notes: 'Updated via admin panel'
  })

  revalidatePath('/admin/cancellation-policies')
  revalidatePath(`/admin/cancellation-policies/${code}/edit`)
  return { success: true, policy: updatedPolicy }
}
