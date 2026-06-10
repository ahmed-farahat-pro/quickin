'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons in Next.js/Leaflet
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

interface ListingMapProps {
  center: [number, number]
  location?: string
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 13)
  }, [center, map])
  return null
}

const ListingMap = ({ center, location }: ListingMapProps) => {
  return (
    <div className='h-[400px] w-full rounded-xl overflow-hidden shadow-sm border relative z-0'>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className='h-full w-full'
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center} icon={customIcon}>
          <Popup>
            {location || 'Listing Location'}
          </Popup>
        </Marker>
        <MapUpdater center={center} />
      </MapContainer>
    </div>
  )
}

export default ListingMap
