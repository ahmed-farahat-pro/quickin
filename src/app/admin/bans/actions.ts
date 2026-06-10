'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteBan(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: ban } = await supabase.from('user_bans').select('*, target_user:profiles!user_bans_user_id_fkey(full_name)').eq('id', id).single()

  const { error } = await supabase.from('user_bans').delete().eq('id', id)

  if (error) {
    console.error('Error deleting ban:', error)
    return { error: error.message }
  }

  if (ban) {
    await supabase.rpc('create_audit_log', {
      p_action: 'ban.delete',
      p_entity_type: 'user_ban',
      p_entity_id: id,
      p_entity_name: `Ban for ${(ban.target_user as any)?.full_name}`,
      p_old_data: ban,
      p_notes: 'Ban record permanently deleted via admin panel'
    })
  }

  revalidatePath('/admin/bans')
  return { success: true }
}

export async function liftBan(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: ban } = await supabase.from('user_bans').select('*, target_user:profiles!user_bans_user_id_fkey(full_name)').eq('id', id).single()

  const { error } = await supabase.from('user_bans').update({ 
    is_active: false,
    unbanned_by: user.id,
    unbanned_at: new Date().toISOString()
  }).eq('id', id)

  if (error) return { error: error.message }

  if (ban) {
    await supabase.rpc('create_audit_log', {
      p_action: 'ban.lift',
      p_entity_type: 'user_ban',
      p_entity_id: id,
      p_entity_name: `Ban for ${(ban.target_user as any)?.full_name}`,
      p_new_data: { is_active: false },
      p_notes: 'Ban lifted via admin panel'
    })
  }

  revalidatePath('/admin/bans')
  return { success: true }
}

export async function createBan(data: any) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  data.banned_by = user.id
  data.is_active = true

  const { data: newBan, error } = await supabase
    .from('user_bans')
    .insert([data])
    .select()
    .single()

  if (error) {
    console.error('Error creating ban:', error)
    return { error: error.message }
  }

  await supabase.rpc('create_audit_log', {
    p_action: 'ban.create',
    p_entity_type: 'user_ban',
    p_entity_id: newBan.id,
    p_entity_name: `Ban for User ${data.user_id}`,
    p_new_data: newBan,
    p_notes: 'Created via admin panel'
  })

  revalidatePath('/admin/bans')
  return { success: true, ban: newBan }
}
