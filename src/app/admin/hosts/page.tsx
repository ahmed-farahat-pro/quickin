import { createClient } from '@/lib/supabase/server'
import { HostsTable } from './hosts-table'
import { Host } from './columns'

async function getHosts(): Promise<Host[]> {
  const supabase = await createClient()
  if (!supabase) return []

  // Get profiles that have at least one listing (hosts)
  const { data: listings } = await supabase
    .from('listings')
    .select('user_id')

  if (!listings || listings.length === 0) return []

  // Get unique host IDs
  const hostIds = [...new Set(listings.map(l => l.user_id))]

  // Get host profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at')
    .in('id', hostIds)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!profiles) return []

  // Count listings per host
  const listingCounts: Record<string, number> = {}
  listings.forEach(l => {
    listingCounts[l.user_id] = (listingCounts[l.user_id] || 0) + 1
  })

  // Get booking counts per host
  const { data: allListings } = await supabase
    .from('listings')
    .select('id, user_id')
    .in('user_id', hostIds)

  const listingToHostMap: Record<string, string> = {}
  allListings?.forEach(l => {
    listingToHostMap[l.id] = l.user_id
  })

  const { data: bookings } = await supabase
    .from('bookings')
    .select('listing_id')

  const bookingCounts: Record<string, number> = {}
  bookings?.forEach((b) => {
    const hostId = listingToHostMap[b.listing_id]
    if (hostId) {
      bookingCounts[hostId] = (bookingCounts[hostId] || 0) + 1
    }
  })

  return profiles.map(p => ({
    ...p,
    listings_count: listingCounts[p.id] || 0,
    total_bookings: bookingCounts[p.id] || 0,
  }))
}

export default async function HostsPage() {
  const hosts = await getHosts()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hosts</h1>
        <p className="text-muted-foreground">
          View all hosts and their listings on the platform.
        </p>
      </div>

      <HostsTable hosts={hosts} />
    </div>
  )
}
