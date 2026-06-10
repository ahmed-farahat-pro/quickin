import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client with service_role key.
 * ONLY use this server-side for admin operations like:
 * - Inviting users by email
 * - Managing user accounts
 * - Bypassing RLS for admin operations
 * 
 * NEVER expose the service_role key to the client.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase admin credentials')
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
