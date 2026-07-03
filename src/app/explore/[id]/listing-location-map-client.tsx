'use client'

// Client island so the server detail page can embed the Leaflet map without
// pulling window-touching Leaflet into SSR. Loads the map with ssr:false.
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('./listing-location-map'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 280, borderRadius: 18, background: '#EFE6D8' }} />
  ),
})

export default function ListingLocationMapClient({ lat, lng }: { lat: number; lng: number }) {
  return <Map lat={lat} lng={lng} />
}
