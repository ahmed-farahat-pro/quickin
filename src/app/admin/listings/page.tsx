import { createClient } from '@/lib/supabase/server'
import { ListingsTable } from './listings-table'

export const dynamic = 'force-dynamic'
import { Listing } from './columns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

async function getListings(): Promise<Listing[]>
{
  const supabase = await createClient()
  if (!supabase) return []

  // First get listings with user_id and active bookings
  const { data: listings, error } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      is_published,
      review_status,
      price_per_night,
      created_at,
      city:cities(name),
      country:countries(name),
      user_id,
      listing_code,
      bookings(status)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching listings:', error)
    return []
  }

  if (!listings || listings.length === 0) {
    return []
  }

  // Get unique user IDs and fetch their profiles
  const userIds = [...new Set(listings.map(l => l.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  // Create a map of user_id to profile
  const profileMap: Record<string, { full_name: string | null; email: string }> = {}
  profiles?.forEach(p =>
  {
    profileMap[p.id] = { full_name: p.full_name, email: p.email }
  })

  // Combine data
  return listings.map(listing => {
    // Count active bookings (pending, confirmed, active, stalled)
    const activeBookingCount = (listing.bookings || []).filter((b: any) => 
      ['pending', 'confirmed', 'active', 'stalled'].includes(b.status)
    ).length

    return {
      id: listing.id,
      title: listing.title,
      is_published: listing.is_published,
      review_status: listing.review_status || 'draft',
      price_per_night: listing.price_per_night,
      created_at: listing.created_at,
      city: Array.isArray(listing.city) ? listing.city[0]?.name : (listing.city as any)?.name || null,
      country: Array.isArray(listing.country) ? listing.country[0]?.name : (listing.country as any)?.name || null,
      listing_code: listing.listing_code,
      host: profileMap[listing.user_id] || null,
      active_booking_count: activeBookingCount,
    }
  })
}


export default async function ListingsPage()
{
  const listings = await getListings()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listings</h1>
          <p className="text-muted-foreground">
            View and manage all listings on the platform.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/listings/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Listing
          </Link>
        </Button>
      </div>

      <ListingsTable listings={listings} />
    </div>
  )
}
