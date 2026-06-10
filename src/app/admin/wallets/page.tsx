import { createClient } from '@/lib/supabase/server'
import { WalletsManager } from './wallets-manager'

export const dynamic = 'force-dynamic'

async function getWallets() {
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('mobile_wallets')
    .select('*')
    .order('sort_order')
  
  return data || []
}

export default async function AdminWalletsPage() {
  const wallets = await getWallets()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mobile Wallets</h1>
        <p className="text-muted-foreground">
          Manage the mobile wallet payment providers available to guests.
        </p>
      </div>

      <WalletsManager initialWallets={wallets} />
    </div>
  )
}