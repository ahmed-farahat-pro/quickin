'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function deleteComment(commentId: string) {
  try {
    const supabase = await createAdminClient()
    if (!supabase) throw new Error('Missing Supabase admin client')
    const { error } = await supabase
      .from('listing_comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting comment:', error)
    return { error: error.message }
  }
}

export async function toggleCommentVisibility(commentId: string, is_hidden: boolean) {
  try {
    const supabase = await createAdminClient()
    if (!supabase) throw new Error('Missing Supabase admin client')
    const { error } = await supabase
      .from('listing_comments')
      .update({ is_hidden })
      .eq('id', commentId)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error toggling comment visibility:', error)
    return { error: error.message }
  }
}
