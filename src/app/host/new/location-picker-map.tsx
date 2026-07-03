'use client'

// Minimal Leaflet pin picker for the create-listing form. Host clicks (or drags
// the pin) to set the listing's coordinates; we report lat/lng up to the form.
// Client-only (imported via next/dynamic { ssr: false }) — Leaflet reads window.
import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Default view: Cairo (most listings are EGP). Overridden once a pin is set.
const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357]

const pinIcon = L.divIcon({
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  html: `<div style="width:28px;height:28px;transform:translateY(-2px)">
    <svg viewBox="0 0 24 24" width="28" height="28" fill="#5B0F16" stroke="#fff" stroke-width="1.5">
      <path d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5" fill="#fff" stroke="none"/>
    </svg></div>`,
})

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function LocationPickerMap({
  lat,
  lng,
  onChange,
}: {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}) {
  const hasPin = typeof lat === 'number' && typeof lng === 'number'
  const center = useMemo<[number, number]>(
    () => (hasPin ? [lat as number, lng as number] : DEFAULT_CENTER),
    [hasPin, lat, lng]
  )

  return (
    <MapContainer
      center={center}
      zoom={hasPin ? 13 : 5}
      scrollWheelZoom={false}
      style={{ height: 260, width: '100%', borderRadius: 14 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCapture onPick={onChange} />
      {hasPin && (
        <Marker
          position={[lat as number, lng as number]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend(e) {
              const p = (e.target as L.Marker).getLatLng()
              onChange(p.lat, p.lng)
            },
          }}
        />
      )}
    </MapContainer>
  )
}
