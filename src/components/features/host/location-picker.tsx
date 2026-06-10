'use client'

import { useMemo, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons
const iconUrl = '/leaflet/marker-icon.png'
const iconRetinaUrl = '/leaflet/marker-icon-2x.png'
const shadowUrl = '/leaflet/marker-shadow.png'

const customIcon = new L.Icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

interface LocationPickerProps {
  value: { lat: number; lng: number }
  onChange: (value: { lat: number; lng: number }) => void
}

function DraggableMarker({ position, onChange }: { position: L.LatLngExpression, onChange: (pos: L.LatLng) => void }) {
  const markerRef = useRef<L.Marker>(null)

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current
        if (marker != null) {
          onChange(marker.getLatLng())
        }
      },
    }),
    [onChange],
  )

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={customIcon}
    >
      <Popup minWidth={90}>
        <span className="font-medium">Drag only me to adjust location!</span>
      </Popup>
    </Marker>
  )
}

function MapClickHandler({ onClick }: { onClick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng)
    },
  })
  return null
}

function MapUpdater({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap()
  // Only fly to new center if it's significantly different (avoid jitter on drag)
  // Or just don't auto-pan on drag. Typically we only pan on initial load or search.
  // We'll keep it simple: Don't auto-pan on marker move props, only on mount or big jump?
  // Actually, standard behavior: center map on marker initially.
  useEffect(() => {
     map.setView(center, map.getZoom())
  }, [center.lat, center.lng, map])
  
  return null
}

const LocationPicker = ({ value, onChange }: LocationPickerProps) => {
  // Validate coordinates: fallback to Cairo if invalid/NaN/zero
  const isValidLat = (val: number) => typeof val === 'number' && !isNaN(val)
  const isValidLng = (val: number) => typeof val === 'number' && !isNaN(val)
  
  // Check if props are valid, otherwise use defaults
  const lat = (value && isValidLat(value.lat)) ? value.lat : 30.0444
  const lng = (value && isValidLng(value.lng)) ? value.lng : 31.2357
  
  // If inputs are 0,0, also default to Cairo (legacy check)
  const center = (lat === 0 && lng === 0) 
    ? { lat: 30.0444, lng: 31.2357 } 
    : { lat, lng }

  return (
    <div className='h-[400px] w-full rounded-xl overflow-hidden shadow-sm border relative z-0'>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        className='h-full w-full'
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMarker 
          position={center} 
          onChange={(newPos) => onChange({ lat: newPos.lat, lng: newPos.lng })}
        />
        <MapClickHandler onClick={(newPos) => onChange({ lat: newPos.lat, lng: newPos.lng })} />
        <MapUpdater center={center} />
      </MapContainer>
      
      <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur p-2 rounded-lg text-xs text-center z-[1000] shadow-md border">
        Click on the map or drag the marker to pin the exact location.
      </div>
    </div>
  )
}

export default LocationPicker
