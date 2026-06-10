
import { createClient } from '@/lib/supabase/server'
import { DestinationForm } from '@/components/admin/destinations/destination-form'
import { notFound } from 'next/navigation'
import { SearchDestination } from '@/types/database'

interface EditDestinationPageProps
{
  params: {
    id: string
  }
}

async function getDestination(id: string)
{
  const supabase = await createClient()
  if (!supabase) return null

  // Use rpc to get location as WKT so the form can parse lat/lng correctly.
  // The PostGIS `location` column returns as a WKB hex string via the JS client,
  // so we fetch it as text using ST_AsText via a raw query.
  const { data, error } = await supabase.rpc('get_destination_with_wkt', { dest_id: id }).single()

  if (error || !data) {
    // Fallback: fetch without WKT (map will default to Cairo coords)
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('search_destinations')
      .select('*')
      .eq('id', id)
      .single()

    if (fallbackError || !fallbackData) return null
    return fallbackData as SearchDestination
  }

  return data as SearchDestination
}

export default async function EditDestinationPage({ params }: EditDestinationPageProps)
{
  const { id } = await params
  const destination = await getDestination(id)

  if (!destination) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Destination</h1>
        <p className="text-muted-foreground">
          Update destination details and settings.
        </p>
      </div>
      <DestinationForm initialData={destination} />
    </div>
  )
}
