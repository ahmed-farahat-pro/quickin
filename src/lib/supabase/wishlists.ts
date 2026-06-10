'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from './auth-actions'

export async function getWishlists() {
  const user = await getUser()
  if (!user) return []

  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('wishlists')
    .select(`
      *,
      wishlist_items (
        listing:listings (
          id,
          title,
          listing_images (
            url
          )
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching wishlists:', error)
    return []
  }

  return (data || []).map(wishlist => ({
    ...wishlist,
    itemCount: wishlist.wishlist_items?.length || 0,
    previewImages: wishlist.wishlist_items
      ?.map((item: any) => item.listing?.listing_images?.[0]?.url)
      .filter(Boolean)
      .slice(0, 3) || []
  }))
}

export async function getWishlist(id: string) {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('wishlists')
    .select(`
      *,
      wishlist_items (
        listing:listings (
          *,
          listing_images (*)
        )
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching wishlist:', error)
    return null
  }

  return {
    ...data,
    listings: data.wishlist_items?.map((item: any) => {
      const listing = item.listing
      if (!listing) return null
      return {
        ...listing,
        images: listing.listing_images?.map((img: any) => img.url) || []
      }
    }).filter(Boolean) || []
  }
}

export async function createWishlist(name: string) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()
  if (!supabase) return { error: 'Database error' }

  const { data, error } = await supabase
    .from('wishlists')
    .insert({ name, user_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/wishlists')
  return { success: true, data }
}

export async function deleteWishlist(id: string) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()
  if (!supabase) return { error: 'Database error' }

  const { error } = await supabase
    .from('wishlists')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/wishlists')
  return { success: true }
}

export async function addToWishlist(wishlistId: string, listingId: string) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()
  if (!supabase) return { error: 'Database error' }

  const { error } = await supabase
    .from('wishlist_items')
    .insert({ wishlist_id: wishlistId, listing_id: listingId })

  if (error) {
    if (error.code === '23505') return { success: true }
    return { error: error.message }
  }

  revalidatePath('/dashboard/wishlists')
  revalidatePath(`/dashboard/wishlists/${wishlistId}`)
  revalidatePath('/')
  return { success: true }
}

export async function removeFromWishlist(wishlistId: string, listingId: string) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()
  if (!supabase) return { error: 'Database error' }

  const { error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('wishlist_id', wishlistId)
    .eq('listing_id', listingId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/wishlists')
  revalidatePath(`/dashboard/wishlists/${wishlistId}`)
  revalidatePath('/')
  return { success: true }
}

export async function getListingWishlistStatus(listingId: string) {
  const user = await getUser()
  if (!user) return { isSaved: false, wishlists: [] }

  const supabase = await createClient()
  if (!supabase) return { isSaved: false, wishlists: [] }

  const { data: wishlists } = await supabase
    .from('wishlists')
    .select('id, name')
    .eq('user_id', user.id)

  const { data: savedItems } = await supabase
    .from('wishlist_items')
    .select('wishlist_id')
    .eq('listing_id', listingId)

  const savedInIds = new Set(savedItems?.map(i => i.wishlist_id) || [])

  return {
    isSaved: savedInIds.size > 0,
    wishlists: (wishlists || []).map(w => ({
      ...w,
      isSaved: savedInIds.has(w.id)
    }))
  }
}

/**
 * Fetches the IDs of all listings saved in any of the current user's wishlists.
 * Used for batch checking favorited status in lists.
 */
export async function getUserSavedListingIds(): Promise<string[]> {
  const user = await getUser()
  if (!user) return []

  const supabase = await createClient()
  if (!supabase) return []

  // Get wishlists first
  const { data: wishlists } = await supabase
    .from('wishlists')
    .select('id')
    .eq('user_id', user.id)

  if (!wishlists || wishlists.length === 0) return []

  const wishlistIds = wishlists.map(w => w.id)

  const { data: items, error } = await supabase
    .from('wishlist_items')
    .select('listing_id')
    .in('wishlist_id', wishlistIds)

  if (error) {
    console.error('Error fetching saved listing IDs:', error)
    return []
  }

  // Return unique listing IDs
  return Array.from(new Set(items?.map(i => i.listing_id) || []))
}
