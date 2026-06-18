import { createClient } from '@/lib/supabase/server'
import { UsersTable } from './users-table'

export const dynamic = 'force-dynamic'

interface User {
  id: string
  full_name: string | null
  email: string
  is_host: boolean
  created_at: string
  listings_count: number
  warning_count?: number
  is_banned?: boolean
}

async function getUsers(): Promise<User[]> {
  const supabase = await createClient()
  if (!supabase) return []

  // Get profiles with listing counts
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, is_host, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !profiles || profiles.length === 0) return []

  // Get listing counts for each user (user_id column references the host's profile)
  const userIds = profiles.map((p) => p.id)
  const { data: listingCounts } = await supabase
    .from('listings')
    .select('user_id')
    .in('user_id', userIds)

  // Count listings per user
  const countMap: Record<string, number> = {}
  listingCounts?.forEach((l) => {
    countMap[l.user_id] = (countMap[l.user_id] || 0) + 1
  })

  // Get warning counts
  let warningCounts: Record<string, number> = {}
  try {
    const { data: warnings } = await supabase
      .from('user_warnings')
      .select('user_id')
      .in('user_id', userIds)
      .eq('is_active', true)

    warnings?.forEach((w) => {
      warningCounts[w.user_id] = (warningCounts[w.user_id] || 0) + 1
    })
  } catch {
    // Table might not exist
  }

  // Get banned users
  let bannedUsers: Set<string> = new Set()
  try {
    const { data: bans } = await supabase
      .from('user_bans')
      .select('user_id')
      .in('user_id', userIds)
      .eq('is_active', true)

    bans?.forEach((b) => bannedUsers.add(b.user_id))
  } catch {
    // Table might not exist
  }

  return profiles.map((p) => ({
    ...p,
    listings_count: countMap[p.id] || 0,
    warning_count: warningCounts[p.id] || 0,
    is_banned: bannedUsers.has(p.id),
  }))
}

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          View and manage all registered users on the platform.
        </p>
      </div>

      <UsersTable users={users} />
    </div>
  )
}
