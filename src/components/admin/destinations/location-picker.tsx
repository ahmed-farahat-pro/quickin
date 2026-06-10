'use client'

import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Fix implementation for default marker icons
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

interface LocationValue {
  lat: number
  lng: number
  radius: number
}

interface LocationPickerProps {
  value?: LocationValue
  onChange: (value: LocationValue) => void
}

function LocationMarker({ 
  position, 
  setPosition 
}: { 
  position: { lat: number, lng: number } | null
  setPosition: (pos: { lat: number, lng: number }) => void 
}) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng)
      // We rely on the useEffect below to fly to the new position
    },
  })

  // React to position changes (external or internal)
  useEffect(() => {
    if (position) {
      // Use flyTo for smooth animation, set zoom to 12 for good "focus"
      // We check if the move is significant or zoom is too far out? 
      // For now, always centering + zooming to 10 seems robust for "focusing"
      map.flyTo([position.lat, position.lng], 8, { duration: 1 })
    }
  }, [map, position?.lat, position?.lng])

  return position === null ? null : (
    <Marker position={position} icon={customIcon} />
  )
}

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [position, setPosition] = useState<{ lat: number, lng: number } | null>(
    value ? { lat: value.lat, lng: value.lng } : null
  )
  const [radius, setRadius] = useState<number>(value?.radius || 10)

  useEffect(() => {
    if (value) {
        setPosition({ lat: value.lat, lng: value.lng })
        setRadius(value.radius)
    }
  }, [value?.lat, value?.lng, value?.radius]) // Check individual props to avoid loops if object ref changes

  const handlePositionChange = (latlng: { lat: number, lng: number }) => {
    setPosition(latlng)
    onChange({ lat: latlng.lat, lng: latlng.lng, radius })
  }

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius)
    if (position) {
      onChange({ ...position, radius: newRadius })
    }
  }

  // Default center: Egypt (Cairo view)
  const defaultCenter: [number, number] = [30.0444, 31.2357]

  return (
    <div className="space-y-4">
      <div className="h-[400px] w-full rounded-md overflow-hidden border relative z-0">
        <MapContainer
          center={position ? [position.lat, position.lng] : defaultCenter}
          zoom={6} // Start zoomed out to see Egypt
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={handlePositionChange} />
          {position && (
             <Circle 
                center={position} 
                radius={radius * 1000} // radius in meters
                pathOptions={{ color: '#5b0f16', fillColor: '#5b0f16', fillOpacity: 0.14 }}
             />
          )}
        </MapContainer>
      </div>

      <div className="flex items-center px-2 gap-4">
        <div className="grid gap-2 flex-1">
           <Label>Search Radius ({radius} km)</Label>
           <Slider
              value={[radius]}
              onValueChange={(val) => handleRadiusChange(val[0])}
              max={100}
              step={1}
              className="w-full"
           />
        </div>
        <div className="w-24">
            <Label>Radius (km)</Label>
            <Input 
                type="number" 
                value={radius} 
                onChange={(e) => handleRadiusChange(Number(e.target.value))}
                min={1}
            />
        </div>
      </div>
      <div className="text-xs text-muted-foreground flex gap-4 px-2 pb-2">
        <span>Lat: {position?.lat.toFixed(5) || '-'}</span>
        <span>Lng: {position?.lng.toFixed(5) || '-'}</span>
      </div>
    </div>
  )
}
