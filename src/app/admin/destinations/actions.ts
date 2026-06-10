'use server'

import { createClient } from '@/lib/supabase/server'
import { SearchDestinationInsert, SearchDestinationUpdate } from '@/types/database'
import { revalidatePath } from 'next/cache'

export async function searchListings(query: string) {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('listings')
    .select('id, title, city, country, price_per_night, listing_images(url)')
    .ilike('title', `%${query}%`)
    .limit(10)

  if (error) {
    console.error('Error searching listings:', error)
    return []
  }

  // Map listing_images to flat images array for the client
  const listings = data?.map((l: any) => ({
    ...l,
    images: l.listing_images?.map((i: any) => i.url) || []
  }))

  return listings || []
}

export async function upsertDestination(data: SearchDestinationInsert | SearchDestinationUpdate) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  // Check permissions (staff only)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  
  // Basic check - RLS will handle the real enforcement but good to check role if possible
  // We rely on RLS policies "Staff can manage destinations"

  const { error } = await supabase
    .from('search_destinations')
    .upsert(data)
    .select()

  if (error) {
    console.error('Error upserting destination:', error)
    return { error: error.message }
  }

  revalidatePath('/admin/destinations')
  return { success: true }
}

export async function deleteDestination(id: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Not authenticated' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('search_destinations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting destination:', error)
    return { error: error.message }
  }

  revalidatePath('/admin/destinations')
  return { success: true }
}
