// =============================================================================
// SUPABASE BROWSER CLIENT
// =============================================================================
// Description: Creates a Supabase client for use in browser/client components
// Usage: Import and call createClient() in any 'use client' component
// 
// Note: This client is for browser-side operations only.
//       For server components, use @/lib/supabase/server instead.
// =============================================================================

import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for browser-side operations
 * Used in client components for auth, real-time, and data operations
 * 
 * @returns Supabase client instance
 * @example
 * ```tsx
 * 'use client'
 * import { createClient } from '@/lib/supabase/client'
 * 
 * const supabase = createClient()
 * const { data } = await supabase.from('listings').select('*')
 * ```
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null as any
  return createBrowserClient(url, key)
}
