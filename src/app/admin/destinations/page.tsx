import { createClient } from '@/lib/supabase/server'
import { DestinationsTable } from './destinations-table'

export const dynamic = 'force-dynamic'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { SearchDestination } from '@/types/database'

async function getDestinations(): Promise<SearchDestination[]>
{
  const supabase = await createClient()
  if (!supabase) return []

  const { data: destinations, error } = await supabase
    .from('search_destinations')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching destinations:', error)
    return []
  }

  // Cast specific fields to match types if needed, though they should match automatically
  return (destinations || []) as SearchDestination[]
}

export default async function DestinationsPage()
{
  const destinations = await getDestinations()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Destinations</h1>
          <p className="text-muted-foreground">
            Manage search destinations, curated areas, and spotlight locations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/destinations/new">
            <Button className='gap-2'>
              <Plus className="h-4 w-4" />
              Add Destination
            </Button>
          </Link>
        </div>
      </div>

      <DestinationsTable destinations={destinations} />
    </div>
  )
}
