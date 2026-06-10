'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteAttribute(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get before deleting
  const { data: attr } = await supabase.from('attributes').select('*').eq('id', id).single()

  // Try to delete (may fail if used in listings)
  const { error } = await supabase.from('attributes').delete().eq('id', id)

  if (error) {
    console.error('Error deleting attribute:', error)
    if (error.code === '23503') { // Foreign key violation
      return { error: 'This attribute is currently in use by one or more listings. Please disable it instead of deleting it.' }
    }
    return { error: error.message }
  }

  if (attr) {
    await supabase.rpc('create_audit_log', {
      p_action: 'attribute.delete',
      p_entity_type: 'attribute',
      p_entity_id: id,
      p_entity_name: attr.label,
      p_old_data: attr,
      p_notes: 'Deleted via admin panel'
    })
  }

  revalidatePath('/admin/attributes')
  return { success: true }
}

export async function toggleAttributeStatus(id: string, is_enabled: boolean, label: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('attributes').update({ is_enabled }).eq('id', id)

  if (error) return { error: error.message }

  await supabase.rpc('create_audit_log', {
    p_action: is_enabled ? 'attribute.enable' : 'attribute.disable',
    p_entity_type: 'attribute',
    p_entity_id: id,
    p_entity_name: label,
    p_new_data: { is_enabled },
    p_notes: 'Status toggled via admin panel'
  })

  revalidatePath('/admin/attributes')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: cat } = await supabase.from('attribute_categories').select('*').eq('id', id).single()

  const { error } = await supabase.from('attribute_categories').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return { error: 'This category contains attributes. Please delete or reassign them first.' }
    }
    return { error: error.message }
  }

  if (cat) {
    await supabase.rpc('create_audit_log', {
      p_action: 'attribute_category.delete',
      p_entity_type: 'attribute_category',
      p_entity_id: id,
      p_entity_name: cat.label,
      p_old_data: cat,
      p_notes: 'Deleted via admin panel'
    })
  }

  revalidatePath('/admin/attributes')
  return { success: true }
}

export async function createAttribute(data: any, options: any[]) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  data.created_by = user.id

  const { data: newAttr, error } = await supabase
    .from('attributes')
    .insert([data])
    .select()
    .single()

  if (error) {
    console.error('Error creating attribute:', error)
    return { error: error.message }
  }

  if (options && options.length > 0) {
    const optsToInsert = options.map((opt, idx) => ({
      ...opt,
      attribute_id: newAttr.id,
      display_order: idx
    }))
    await supabase.from('attribute_options').insert(optsToInsert)
  }

  await supabase.rpc('create_audit_log', {
    p_action: 'attribute.create',
    p_entity_type: 'attribute',
    p_entity_id: newAttr.id,
    p_entity_name: newAttr.label,
    p_new_data: { ...newAttr, options },
    p_notes: 'Created via admin panel'
  })

  revalidatePath('/admin/attributes')
  return { success: true, attribute: newAttr }
}

export async function updateAttribute(id: string, data: any, options: any[]) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: oldAttr } = await supabase.from('attributes').select('*').eq('id', id).single()

  const { data: updatedAttr, error } = await supabase
    .from('attributes')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating attribute:', error)
    return { error: error.message }
  }

  // Handle options: Delete all and re-insert for simplicity and to match sort orders
  // First, we must ensure we are not deleting options actively used by listings if possible,
  // but if we recreate them with new IDs, it breaks foreign keys!
  // It's safer to upsert options or delete only removed ones.
  // We'll use upsert for options.
  
  // Get existing options
  const { data: existingOpts } = await supabase.from('attribute_options').select('id').eq('attribute_id', id)
  const existingIds = existingOpts?.map(o => o.id) || []
  
  const incomingIds = options.filter(o => o.id).map(o => o.id)
  const toDelete = existingIds.filter(id => !incomingIds.includes(id))

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from('attribute_options').delete().in('id', toDelete)
    if (delErr && delErr.code === '23503') {
       return { error: 'Cannot remove option because it is used by an active listing.' }
    }
  }

  if (options && options.length > 0) {
    const optsToUpsert = options.map((opt, idx) => {
      const { id: optId, ...rest } = opt
      // if it has an id, include it for update, otherwise let DB generate it
      return optId && !optId.startsWith('new-') 
        ? { ...rest, id: optId, attribute_id: id, display_order: idx }
        : { ...rest, attribute_id: id, display_order: idx }
    })
    
    const { error: upsertErr } = await supabase.from('attribute_options').upsert(optsToUpsert)
    if (upsertErr) {
       console.error('Error upserting options:', upsertErr)
       return { error: upsertErr.message }
    }
  }

  await supabase.rpc('create_audit_log', {
    p_action: 'attribute.update',
    p_entity_type: 'attribute',
    p_entity_id: id,
    p_entity_name: updatedAttr.label,
    p_old_data: oldAttr,
    p_new_data: { ...updatedAttr, options },
    p_notes: 'Updated via admin panel'
  })

  revalidatePath('/admin/attributes')
  revalidatePath(`/admin/attributes/${id}/edit`)
  return { success: true, attribute: updatedAttr }
}
