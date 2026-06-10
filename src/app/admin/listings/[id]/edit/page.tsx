import { createClient } from '@/lib/supabase/server'
import { ListingForm } from '@/components/admin/listings/listing-form'
import { notFound } from 'next/navigation'

export default async function EditListingPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const id = params.id
  const supabase = await createClient()
  if (!supabase) return notFound()

  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      *,
      listing_images (id, url, category, order),
      listing_lifestyles (lifestyle_category_id),
      listing_condition_assignments (condition_id),
      country_ref:countries(name),
      state_ref:states(name),
      city_ref:cities(name)
    `)
    .eq('id', id)
    .single()

  if (error || !listing) {
    return notFound()
  }

  // Parse location_geo (GeoJSON or EWKT)
  let latitude = 0
  let longitude = 0
  if (listing.location_geo) {
    if (typeof listing.location_geo === 'string') {
      // EWKT string like POINT(lng lat)
      const match = listing.location_geo.match(/POINT\(([-\d.]+) ([-\d.]+)\)/)
      if (match) {
        longitude = parseFloat(match[1])
        latitude = parseFloat(match[2])
      }
    } else if ((listing.location_geo as any).coordinates) {
      // GeoJSON
      longitude = (listing.location_geo as any).coordinates[0]
      latitude = (listing.location_geo as any).coordinates[1]
    }
  }

  // Extract translations
  const translations = listing.translations as any
  const title_ar = translations?.ar?.title || ''
  const description_ar = translations?.ar?.description || ''

  const formData = {
    id: listing.id,
    title: listing.title,
    title_ar,
    description: listing.description || '',
    description_ar,
    price_per_night: listing.price_per_night,
    cleaning_fee: listing.cleaning_fee || 0,
    currency: listing.currency || 'EGP',
    property_type_id: listing.property_type_id || '',
    location: listing.location,
    country: (listing as any).country_ref?.name || '',
    country_id: listing.country_id || '',
    state: (listing as any).state_ref?.name || '',
    state_id: listing.state_id || '',
    city: (listing as any).city_ref?.name || '',
    city_id: listing.city_id || '',
    latitude,
    longitude,
    max_guests: listing.max_guests || 1,
    bedrooms: listing.bedrooms || 1,
    beds: listing.beds || 1,
    bathrooms: listing.bathrooms || 1,
    min_nights: listing.min_nights || 1,
    is_published: listing.is_published || false,
    google_maps_link: listing.google_maps_link || '',
    user_id: listing.user_id,
    lifestyle_category_ids: listing.listing_lifestyles?.map((ll: any) => ll.lifestyle_category_id) || [],
    listing_conditions: listing.listing_condition_assignments?.map((lc: any) => lc.condition_id) || [],
  }

  const initialImages = (listing.listing_images || []).sort((a: any, b: any) => a.order - b.order)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Listing</h1>
        <p className="text-muted-foreground">
          Modify details for {listing.title}
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <ListingForm 
          initialData={formData} 
          initialImages={initialImages} 
          isEditing 
        />
      </div>
    </div>
  )
}
