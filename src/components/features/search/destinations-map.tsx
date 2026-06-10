'use client'
// Re-compile trigger

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef, type RefObject } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import { ListingCardUnified } from '@/components/features/listings/listing-card-unified'
import { Home, Building, Building2, Gem, Hotel, Tent, Castle, Globe, Ship, Car, PartyPopper, Map as MapIcon } from 'lucide-react'
import { renderToString } from 'react-dom/server'

// Define the exact shape we need for the map to avoid type conflicts with strict DB rows
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
  review_count?: number
  is_guest_favorite?: boolean
  max_guests?: number
  bedrooms?: number
  bathrooms?: number

  best_offer_price?: number | null
}

// Helper to get icon component based on string
const getIconComponent = (iconName?: string | null, size = 10) =>
{
  switch (iconName) {
    case 'Building': return <Building size={size} strokeWidth={3} />
    case 'Building2': return <Building2 size={size} strokeWidth={3} />
    case 'Gem': return <Gem size={size} strokeWidth={3} />
    case 'Hotel': return <Hotel size={size} strokeWidth={3} />
    case 'Tent': return <Tent size={size} strokeWidth={3} />
    case 'Castle': return <Castle size={size} strokeWidth={3} />
    case 'Globe': return <Globe size={size} strokeWidth={3} />
    case 'Ship': return <Ship size={size} strokeWidth={3} />
    case 'Car': return <Car size={size} strokeWidth={3} />
    case 'PartyPopper': return <PartyPopper size={size} strokeWidth={3} />
    case 'MapBase': return <MapIcon size={size} strokeWidth={3} />
    case 'Home':
    default: return <Home size={size} strokeWidth={3} />
  }
}

// Custom Marker Icon (Price Pill)
const createPriceIcon = (price: number, currency = 'EGP', iconName?: string | null, isHighlighted = false, locale = 'en-US') =>
{
  // Generate static HTML for the icon using renderToString to support Lucide icons
  const iconHtml = renderToString(
    <div className={cn(
      "flex items-center gap-1.5 bg-white rounded-full shadow-md border px-2 py-1 transition-all transform",
      isHighlighted ? "scale-110 border-primary ring-2 ring-primary ring-offset-1 z-50" : "border-gray-200 hover:scale-105"
    )}>
      <div className={cn(
        "flex items-center justify-center w-5 h-5 rounded-full shrink-0",
        isHighlighted ? "bg-primary text-white" : "bg-primary text-white"
      )}>
        {getIconComponent(iconName, 10)}
      </div>
      <span className={cn(
        "text-xs font-bold whitespace-nowrap pr-1",
        isHighlighted ? "text-primary" : "text-gray-800"
      )}>
        {currency} {price.toLocaleString(locale)}
      </span>
    </div>
  )

  return L.divIcon({
    className: 'custom-map-marker', // We'll rely on the inner HTML for styling
    html: iconHtml,
    iconSize: [120, 28], // Approximate size, wider to fit currency
    iconAnchor: [60, 28], // Bottom center anchor
  })
}

// Default center (Egypt center)
const DEFAULT_CENTER = { lat: 26.8206, lng: 30.8025 }

// Helper to validate coordinates
const isValidCoord = (lat: any, lng: any): boolean =>
{
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// Component to fly to center or focus on a specific listing
function MapUpdater({
  center,
  zoom,
  focusListingId,
  listings
}: {
  center: { lat: number, lng: number }
  zoom: number
  focusListingId?: string | null
  listings: MapListing[]
})
{
  const map = useMap()
  const lastFocusId = useRef<string | null>(null)
  const lastCenter = useRef<{ lat: number, lng: number } | null>(null)

  useEffect(() =>
  {
    // If there's a focus listing, fly to it
    if (focusListingId && focusListingId !== lastFocusId.current) {
      const listing = listings.find(l => l.id === focusListingId)
      if (listing && isValidCoord(listing.latitude, listing.longitude)) {
        try {
          const mapSize = map.getSize();
          const isHidden = mapSize.x === 0 || mapSize.y === 0;

          // Ensure the map knows its actual size before animating
          map.invalidateSize()

          if (isHidden) {
            map.setView([listing.latitude!, listing.longitude!], Math.max(zoom || 10, 14), { animate: false })
          } else {
            map.flyTo([listing.latitude!, listing.longitude!], Math.max(zoom || 10, 14), { duration: 0.8 })
          }
          lastFocusId.current = focusListingId
        } catch (e) {
          console.warn('MapUpdater: Failed to fly to listing', e)
        }
      }
    }
  }, [focusListingId, listings, map, zoom])

  // Initial center / center updates
  useEffect(() =>
  {
    // console.log('MapUpdater: center update check', { center, isValid: isValidCoord(center?.lat, center?.lng) })

    if (!focusListingId && center && isValidCoord(center.lat, center.lng)) {
      // Only fly if center has actually changed
      if (!lastCenter.current ||
        lastCenter.current.lat !== center.lat ||
        lastCenter.current.lng !== center.lng) {
        try {
          const mapSize = map.getSize();
          const isHidden = mapSize.x === 0 || mapSize.y === 0;
          const safeZoom = Number.isFinite(zoom) ? zoom : 10

          // Ensure the map knows its actual size before positioning/animating
          map.invalidateSize()

          // Use setView for the very first update or if map is hidden to avoid NaN animation frames from Leaflet
          if (!lastCenter.current || isHidden) {
            map.setView([center.lat, center.lng], safeZoom, { animate: false })
          } else {
            map.flyTo([center.lat, center.lng], safeZoom, { duration: 1.5 })
          }
          lastCenter.current = { lat: center.lat, lng: center.lng }
        } catch (e) {
          console.error('MapUpdater: Failed to update center', { center, zoom }, e)
        }
      }
    } else {
      if (!focusListingId) {
        console.warn('MapUpdater: Invalid center skipped', center)
      }
    }
  }, [center.lat, center.lng, zoom, map, focusListingId]) // NOTE: We rely on primitives for depependency array

  // Fix for map tiles not loading on first render (container size is 0 or animating)
  // Use multiple invalidation attempts + ResizeObserver to handle CSS transitions
  useEffect(() =>
  {
    // Initial burst of invalidations to catch animation phases
    const timers = [100, 300, 500, 1000].map(delay =>
      setTimeout(() => map.invalidateSize(), delay)
    )

    // Also use ResizeObserver to catch container size changes
    const container = map.getContainer()
    const observer = new ResizeObserver(() =>
    {
      map.invalidateSize()
    })
    observer.observe(container)

    return () =>
    {
      timers.forEach(clearTimeout)
      observer.disconnect()
    }
  }, [map])

  return null
}

interface DestinationsMapProps
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

export default function DestinationsMap({
  center,
  zoom = 10,
  listings = [],
  className,
  focusListingId,
  hoveredListingId,
  onMarkerClick,
  openPopupForId
}: DestinationsMapProps)
{
  const locale = useLocale()
  // Refs to Leaflet marker instances so we can open popups programmatically
  const markerRefs = useRef<Map<string, L.Marker>>(new Map())

  // Validate and provide safe default coordinates
  const safeCenter = isValidCoord(center?.lat, center?.lng)
    ? { lat: center.lat, lng: center.lng }
    : DEFAULT_CENTER

  return (
    <div className={cn('w-full h-[calc(100vh-180px)] rounded-xl overflow-hidden shadow-sm border relative z-0 mt-4', className)}>
      <MapContainer
        center={[safeCenter.lat, safeCenter.lng]}
        zoom={zoom}
        scrollWheelZoom={true}
        className='h-full w-full'
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapUpdater
          center={safeCenter}
          zoom={zoom}
          focusListingId={focusListingId}
          listings={listings}
        />

        {listings.map((listing) =>
        {
          if (!isValidCoord(listing.latitude, listing.longitude)) return null

          const isHighlighted = listing.id === hoveredListingId || listing.id === focusListingId
          const icon = createPriceIcon(listing.price_per_night, listing.currency || 'EGP', listing.icon, isHighlighted, locale)

          return (
            <Marker
              key={listing.id}
              position={[listing.latitude!, listing.longitude!]}
              icon={icon}
              zIndexOffset={isHighlighted ? 1000 : 0}
              ref={(markerRef) =>
              {
                if (markerRef) {
                  markerRefs.current.set(listing.id, markerRef)
                } else {
                  markerRefs.current.delete(listing.id)
                }
              }}
              eventHandlers={{
                click: () => onMarkerClick?.(listing.id)
              }}
            >
              <Popup
                className="listing-popup-card"
                minWidth={300}
                maxWidth={300}
                closeButton={true}
              >
                <div className="p-0 m-0 w-full overflow-hidden rounded-2xl">
                  <ListingCardUnified
                    id={listing.id}
                    title={listing.title}
                    location={listing.location}
                    city={listing.city}
                    country={listing.country}
                    price={listing.price_per_night}
                    currency={listing.currency || 'EGP'}
                    rating={listing.rating}
                    reviewCount={listing.review_count}
                    images={listing.images}
                    isGuestFavorite={listing.is_guest_favorite}

                    bestOfferPrice={listing.best_offer_price}
                    // Map specific props
                    isMapActive={true}
                    enableCarousel={true}
                    expanded={false} // Use compact card in popup
                    maxGuests={listing.max_guests}
                    bedrooms={listing.bedrooms}
                    bathrooms={listing.bathrooms}
                  />
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Programmatically open popup when openPopupForId changes */}
        <PopupOpener openPopupForId={openPopupForId} markerRefs={markerRefs} />

      </MapContainer>
    </div>
  )
}

// Helper: opens the popup of a specific marker when openPopupForId changes
function PopupOpener({
  openPopupForId,
  markerRefs
}: {
  openPopupForId?: string | null
  markerRefs: RefObject<Map<string, L.Marker>>
})
{
  const map = useMap()
  const lastOpenedId = useRef<string | null>(null)

  useEffect(() =>
  {
    if (openPopupForId && openPopupForId !== lastOpenedId.current) {
      const marker = markerRefs.current?.get(openPopupForId)
      if (marker) {
        try {
          map.invalidateSize()
          marker.openPopup()
          lastOpenedId.current = openPopupForId
        } catch (e) {
          console.warn('PopupOpener: failed to open popup', e)
        }
      }
    }
  }, [openPopupForId, markerRefs, map])

  return null
}
