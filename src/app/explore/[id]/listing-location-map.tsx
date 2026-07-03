'use client'

// Approximate-location map for the listing detail page. Shows a circle (not a
// pin) over a coarsened coordinate so the guest sees the neighbourhood, not the
// exact address. Client-only (dynamic { ssr: false }) — Leaflet touches window.
import { MapContainer, TileLayer, Circle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { approxLatLng, APPROX_RADIUS_M } from '@/lib/geo'

export default function ListingLocationMap({ lat, lng }: { lat: number; lng: number }) {
  const c = approxLatLng(lat, lng)
  return (
    <MapContainer
      center={[c.lat, c.lng]}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: 280, width: '100%', borderRadius: 18 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={[c.lat, c.lng]}
        radius={APPROX_RADIUS_M}
        pathOptions={{ color: '#5B0F16', fillColor: '#5B0F16', fillOpacity: 0.12, weight: 2 }}
      />
    </MapContainer>
  )
}
