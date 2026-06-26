'use client'

// Leaflet map for the explore page with Airbnb-style PRICE PINS.
// Rendered ONLY on the client (imported via next/dynamic with { ssr: false }
// from listings-map.tsx) because Leaflet touches `window` at module load.
//
// Each listing is drawn as a rounded burgundy "$price" pill (an L.divIcon)
// instead of the default teardrop marker. Clicking a pill opens a popup with a
// photo thumbnail + title + location + price + a link to /explore/[id].
import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useTranslations } from 'next-intl'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Listing } from '@/lib/local/db'

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80'

const COLORS = {
  burgundy: '#5B0F16',
  ink: '#2A2220',
  muted: '#6B6055',
}

type GeoListing = Listing & { lat: number; lng: number }

// Escape any user-controlled text we drop into the divIcon HTML string.
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Build the rounded burgundy price-pill marker (Airbnb style). The pill scales
// itself, so we let Leaflet size the icon to its content and anchor it at the
// center so the pill sits exactly over the coordinate.
function priceIcon(listing: GeoListing): L.DivIcon {
  const price = `${listing.currency === 'USD' || !listing.currency ? '$' : ''}${listing.price_per_night}`
  return L.divIcon({
    className: '',
    iconSize: undefined,
    iconAnchor: undefined,
    html: `<div style="background:#5B0F16;color:#fff;font-weight:700;font-size:13px;padding:5px 10px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap;transform:translate(-50%,-50%);display:inline-block">${esc(price)}</div>`,
  })
}

// Keep the visible map bounds in sync with the current (filtered) markers.
function FitBounds({ points }: { points: GeoListing[] }) {
  const map = useMap()
  // Serialize coordinates so the effect only re-runs when the set actually changes.
  const key = points.map((p) => `${p.id}:${p.lat},${p.lng}`).join('|')

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11, { animate: false })
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13, animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])

  return null
}

export default function LeafletListingsMap({ listings }: { listings: Listing[] }) {
  const t = useTranslations('explorePage')
  // Only listings with real coordinates can be placed on the map.
  const points = useMemo<GeoListing[]>(
    () =>
      listings.filter(
        (l): l is GeoListing =>
          typeof l.lat === 'number' &&
          typeof l.lng === 'number' &&
          Number.isFinite(l.lat) &&
          Number.isFinite(l.lng)
      ),
    [listings]
  )

  // Stable initial view (markers + FitBounds refine it once mounted).
  // MapContainer only reads `center`/`zoom` on first mount, so compute these
  // once and never recompute — feeding fresh values on every keystroke would
  // otherwise yank the viewport while the user pans.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialCenter = useMemo<[number, number]>(
    () => (points.length > 0 ? [points[0].lat, points[0].lng] : [20, 0]),
    []
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialZoom = useMemo(() => (points.length > 0 ? 5 : 2), [])

  return (
    <div
      style={{
        height: '70vh',
        width: '100%',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1px solid rgba(42,34,32,0.08)',
        boxShadow: '0 6px 24px rgba(42,34,32,0.08)',
      }}
    >
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {points.map((listing) => {
          const thumb = listing.listing_images[0]?.url || FALLBACK_IMG
          const price = `${listing.currency === 'USD' || !listing.currency ? '$' : ''}${listing.price_per_night}`
          return (
            <Marker
              key={listing.id}
              position={[listing.lat, listing.lng]}
              icon={priceIcon(listing)}
            >
              <Popup>
                <a
                  href={`/explore/${listing.id}`}
                  style={{
                    display: 'block',
                    width: 180,
                    textDecoration: 'none',
                    color: COLORS.ink,
                  }}
                >
                  <img
                    src={thumb}
                    alt={listing.title}
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = FALLBACK_IMG
                    }}
                    style={{
                      width: '100%',
                      height: 110,
                      objectFit: 'cover',
                      borderRadius: 10,
                      display: 'block',
                      marginBottom: 8,
                    }}
                  />
                  <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>
                    {listing.title}
                  </div>
                  {listing.location && (
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                      {listing.location}
                    </div>
                  )}
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    <span style={{ fontWeight: 700, color: COLORS.burgundy }}>
                      {price}
                    </span>{' '}
                    <span style={{ color: COLORS.muted }}>{t('card.perNight')}</span>
                  </div>
                </a>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
