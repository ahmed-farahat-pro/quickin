'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteCondition(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get before deleting
  const { data: condition } = await supabase.from('listing_conditions').select('*').eq('id', id).single()

  const { error } = await supabase.from('listing_conditions').delete().eq('id', id)

  if (error) {
    console.error('Error deleting condition:', error)
    if (error.code === '23503') { // Foreign key violation
      return { error: 'This condition is currently in use by one or more listings. Please disable or unapprove it instead.' }
    }
    return { error: error.message }
  }

  if (condition) {
    await supabase.rpc('create_audit_log', {
      p_action: 'condition.delete',
      p_entity_type: 'condition',
      p_entity_id: id,
      p_entity_name: condition.name,
      p_old_data: condition,
      p_notes: 'Deleted via admin panel'
    })
  }

  revalidatePath('/admin/conditions')
  return { success: true }
}

export async function toggleConditionApproval(id: string, is_approved: boolean, name: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('listing_conditions').update({ is_approved }).eq('id', id)

  if (error) return { error: error.message }

  await supabase.rpc('create_audit_log', {
    p_action: is_approved ? 'condition.approve' : 'condition.unapprove',
    p_entity_type: 'condition',
    p_entity_id: id,
    p_entity_name: name,
    p_new_data: { is_approved },
    p_notes: 'Status toggled via admin panel'
  })

  revalidatePath('/admin/conditions')
  return { success: true }
}

export async function createCondition(data: any) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  data.created_by = user.id

  const { data: newCond, error } = await supabase
    .from('listing_conditions')
    .insert([data])
    .select()
    .single()

  if (error) {
    console.error('Error creating condition:', error)
    return { error: error.message }
  }

  await supabase.rpc('create_audit_log', {
    p_action: 'condition.create',
    p_entity_type: 'condition',
    p_entity_id: newCond.id,
    p_entity_name: newCond.name,
    p_new_data: newCond,
    p_notes: 'Created via admin panel'
  })

  revalidatePath('/admin/conditions')
  return { success: true, condition: newCond }
}

export async function updateCondition(id: string, data: any) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: oldCond } = await supabase.from('listing_conditions').select('*').eq('id', id).single()

  const { data: updatedCond, error } = await supabase
    .from('listing_conditions')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating condition:', error)
    return { error: error.message }
  }

  await supabase.rpc('create_audit_log', {
    p_action: 'condition.update',
    p_entity_type: 'condition',
    p_entity_id: id,
    p_entity_name: updatedCond.name,
    p_old_data: oldCond,
    p_new_data: updatedCond,
    p_notes: 'Updated via admin panel'
  })

  revalidatePath('/admin/conditions')
  revalidatePath(`/admin/conditions/${id}/edit`)
  return { success: true, condition: updatedCond }
}
