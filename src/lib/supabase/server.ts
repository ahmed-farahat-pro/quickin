// =============================================================================
// SUPABASE SERVER CLIENT
// =============================================================================
// Description: Creates a Supabase client for use in server components/actions
// Usage: Import and await createClient() in server components or 'use server'
// 
// Note: This client handles cookie-based auth for SSR.
//       For client components, use @/lib/supabase/client instead.
// =============================================================================

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for server-side operations
 * Handles cookie management for auth session persistence
 * 
 * @returns Supabase client instance or null if not configured
 * @example
 * ```tsx
 * import { createClient } from '@/lib/supabase/server'
 * 
 * export default async function Page() {
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('listings').select('*')
 * }
 * ```
 */
export async function createClient() {
  // Return null if Supabase is not configured (for development without DB)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase not configured - missing environment variables')
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        /**
         * Get all cookies for auth session
         */
        getAll() {
          return cookieStore.getAll()
        },
        /**
         * Set cookies for auth session persistence
         * Note: This may fail in Server Components (read-only context)
         */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}

/**
 * Creates a Supabase admin client using the service role key.
 * Used for bypassing RLS during specific backend processes (e.g. mobile handoff receipt upload).
 */
export async function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Supabase service role not configured')
    return null
  }

  // Use the standard supabase-js client to avoid cookie restrictions since we bypass RLS anyway
  const { createClient: createSupjsClient } = await import('@supabase/supabase-js')
  return createSupjsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
