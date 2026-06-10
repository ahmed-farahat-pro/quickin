'use client'

import dynamic from 'next/dynamic'

// Dynamic import for Map inside a Client Component
const DestinationsMap = dynamic(() => import('./destinations-map'), {
  ssr: false,
  loading: () => <div className="h-[calc(100vh-180px)] w-full bg-slate-100 animate-pulse rounded-xl mt-4" />
})

interface MapListing
{
  id: string
  title: string
  location: string
  latitude: number | null
  longitude: number | null
  price_per_night: number
  currency: string | null
  icon?: string | null
  city: string | null
  country: string | null
  images: string[]
  rating?: number
  is_guest_favorite?: boolean
  max_guests?: number
  bedrooms?: number
  bathrooms?: number
}

interface DestinationsMapWrapperProps
{
  center: { lat: number, lng: number }
  zoom?: number
  listings?: MapListing[]
  className?: string
  focusListingId?: string | null
  hoveredListingId?: string | null
  onMarkerClick?: (id: string) => void
  openPopupForId?: string | null
}

export function DestinationsMapWrapper(props: DestinationsMapWrapperProps)
{
  return <DestinationsMap {...props} />
}
