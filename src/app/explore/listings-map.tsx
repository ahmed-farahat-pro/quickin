'use client'

// Map chooser for the explore page. Decides between Google Maps and Leaflet
// based on whether NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured:
//
//   - key present  -> Google Maps (google-listings-map.tsx)
//   - key missing  -> Leaflet price-pin map (leaflet-listings-map.tsx)
//
// Both render the same Airbnb-style burgundy "$price" pills over the FILTERED
// listings, so the page always shows a working price-pin map and silently
// upgrades to Google Maps the moment the key is set.
//
// This module (and the maps it loads) are client-only: explore-client.tsx
// imports it via next/dynamic with { ssr: false } because both map libraries
// touch `window` at load time.
import type { Listing } from '@/lib/local/db'
import LeafletListingsMap from './leaflet-listings-map'
import GoogleListingsMap from './google-listings-map'

// Inlined at build time by Next. Empty string when unset -> Leaflet fallback.
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export default function ListingsMap({ listings }: { listings: Listing[] }) {
  if (GOOGLE_MAPS_API_KEY) {
    return <GoogleListingsMap listings={listings} apiKey={GOOGLE_MAPS_API_KEY} />
  }
  return <LeafletListingsMap listings={listings} />
}
