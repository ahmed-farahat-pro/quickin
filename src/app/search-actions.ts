'use server'

import { getListingByCode } from '@/lib/supabase/queries'

export async function findListingByCode(code: string) {
  if (!code || code.length !== 4) return null
  
  try {
    const listing = await getListingByCode(code)
    return listing?.id || null
  } catch (error) {
    console.error('Error finding listing by code:', error)
    return null
  }
}
