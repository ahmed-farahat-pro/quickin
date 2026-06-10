import { createClient } from '@/lib/supabase/server'
import { BansTable } from './bans-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getBans() {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('user_bans')
    .select(`
      *,
      target_user:profiles!user_bans_user_id_fkey(full_name, email),
      banned_by_user:profiles!user_bans_banned_by_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching bans:', error)
    return []
  }

  return data.map(ban => ({
    ...ban,
    target_user: Array.isArray(ban.target_user) ? ban.target_user[0] : ban.target_user,
    banned_by_user: Array.isArray(ban.banned_by_user) ? ban.banned_by_user[0] : ban.banned_by_user,
  }))
}

export default async function BansPage() {
  const bans = await getBans()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Bans</h1>
          <p className="text-muted-foreground">
            Manage temporary and permanent platform bans for users.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/bans/new">
            <Plus className="h-4 w-4 mr-2" />
            Issue Ban
          </Link>
        </Button>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <BansTable bans={bans} />
      </div>
    </div>
  )
}
