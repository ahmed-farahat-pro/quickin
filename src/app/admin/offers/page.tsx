import { createClient } from '@/lib/supabase/server'
import { OffersTable } from './offers-table'

export const dynamic = 'force-dynamic'

async function getOffers() {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('listing_best_offers')
    .select(`
      *,
      listing:listings(title)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching best offers:', error)
    return []
  }

  // Flatten the array if needed or map the relation so it matches the expected interface
  return data.map(offer => ({
    ...offer,
    listing: Array.isArray(offer.listing) ? offer.listing[0] : offer.listing
  }))
}

export default async function OffersPage() {
  const offers = await getOffers()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Best Offers</h1>
          <p className="text-muted-foreground">
            Review and manage host requests for Best Offers on their listings.
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <OffersTable offers={offers} />
      </div>
    </div>
  )
}
