'use client'

// Google Maps version of the explore price-pin map. Used ONLY when
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set (listings-map.tsx decides). Loads the
// Maps JavaScript API on demand, then renders one Airbnb-style burgundy
// "$price" pill per listing. Clicking a pill opens an InfoWindow with a photo
// thumbnail + title + location + price + a link to /explore/[id]. The map fits
// its bounds to the markers and rebuilds them whenever the listings change.
import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import type { Listing } from '@/lib/local/db'

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80'

const COLORS = {
  burgundy: '#5B0F16',
  ink: '#2A2220',
  muted: '#6B6055',
}

type GeoListing = Listing & { lat: number; lng: number }

// Minimal structural typings for the slice of the Google Maps JS API we touch.
// We intentionally avoid pulling in @types/google.maps (not installed) and keep
// these loose but typed so we don't reach for `any`.
interface GLatLng {
  lat(): number
  lng(): number
}
interface GLatLngBounds {
  extend(p: { lat: number; lng: number }): void
  isEmpty(): boolean
  getCenter(): GLatLng
}
interface GMap {
  fitBounds(bounds: GLatLngBounds, padding?: number): void
  setCenter(p: { lat: number; lng: number }): void
  setZoom(z: number): void
}
interface GInfoWindow {
  setContent(content: string | Node): void
  open(opts: { map: GMap; anchor?: unknown }): void
  close(): void
}
interface GMarkerLike {
  setMap(map: GMap | null): void
  addListener(event: string, handler: () => void): void
}
interface GMapsApi {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap
  LatLngBounds: new () => GLatLngBounds
  InfoWindow: new (opts?: Record<string, unknown>) => GInfoWindow
  Marker: new (opts: Record<string, unknown>) => GMarkerLike
  marker?: {
    AdvancedMarkerElement: new (opts: Record<string, unknown>) => GMarkerLike
  }
}

declare global {
  interface Window {
    google?: { maps?: GMapsApi }
    __quickinGmapsPromise?: Promise<GMapsApi>
  }
}

// Load the Maps JS API exactly once per page. Subsequent calls reuse the same
// promise (so flipping List/Map or re-rendering never injects a second script).
function loadGoogleMaps(apiKey: string): Promise<GMapsApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser'))
  }
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (window.__quickinGmapsPromise) return window.__quickinGmapsPromise

  window.__quickinGmapsPromise = new Promise<GMapsApi>((resolve, reject) => {
    const params = new URLSearchParams({
      key: apiKey,
      // `marker` library powers AdvancedMarkerElement; `loading=async` is the
      // recommended bootstrap and silences the performance warning.
      libraries: 'marker',
      loading: 'async',
      v: 'weekly',
    })
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error('Google Maps loaded but window.google.maps is missing'))
    }
    script.onerror = () => reject(new Error('Failed to load Google Maps JS API'))
    document.head.appendChild(script)
  })
  return window.__quickinGmapsPromise
}

function priceLabel(listing: Listing): string {
  const dollar = listing.currency === 'USD' || !listing.currency ? '$' : ''
  return `${dollar}${listing.price_per_night}`
}

// Burgundy price-pill DOM node for an AdvancedMarkerElement.
function makePill(label: string): HTMLDivElement {
  const el = document.createElement('div')
  el.textContent = label
  el.style.cssText =
    'background:#5B0F16;color:#fff;font-weight:700;font-size:13px;padding:5px 10px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap;font-family:"DM Sans",ui-sans-serif,system-ui,sans-serif;cursor:pointer'
  return el
}

// InfoWindow body: photo thumbnail + title + location + price + link.
// `perNightLabel` is the already-translated "/ night" suffix.
function infoHtml(listing: GeoListing, perNightLabel: string): string {
  const thumb = listing.listing_images[0]?.url || FALLBACK_IMG
  const price = priceLabel(listing)
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  return `
    <a href="/explore/${esc(listing.id)}" style="display:block;width:180px;text-decoration:none;color:${COLORS.ink};font-family:'DM Sans',ui-sans-serif,system-ui,sans-serif">
      <img src="${esc(thumb)}" alt="${esc(listing.title)}" style="width:100%;height:110px;object-fit:cover;border-radius:10px;display:block;margin-bottom:8px" />
      <div style="font-weight:600;font-size:14px;line-height:1.3">${esc(listing.title)}</div>
      ${listing.location ? `<div style="font-size:12px;color:${COLORS.muted};margin-top:2px">${esc(listing.location)}</div>` : ''}
      <div style="font-size:13px;margin-top:6px">
        <span style="font-weight:700;color:${COLORS.burgundy}">${esc(price)}</span>
        <span style="color:${COLORS.muted}"> ${esc(perNightLabel)}</span>
      </div>
    </a>`
}

export default function GoogleListingsMap({
  listings,
  apiKey,
}: {
  listings: Listing[]
  apiKey: string
}) {
  const t = useTranslations('explorePage')
  const perNightLabel = t('card.perNight')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GMap | null>(null)
  const apiRef = useRef<GMapsApi | null>(null)
  const infoRef = useRef<GInfoWindow | null>(null)
  const markersRef = useRef<GMarkerLike[]>([])

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

  // Serialize point identities so the marker effect only re-runs on real change.
  const pointsKey = points.map((p) => `${p.id}:${p.lat},${p.lng}`).join('|')

  // (Re)build markers for the current points; also fits bounds to them.
  const renderMarkers = (api: GMapsApi, map: GMap) => {
    // Tear down the previous set.
    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []

    const info = infoRef.current ?? new api.InfoWindow()
    infoRef.current = info

    const bounds = new api.LatLngBounds()
    const useAdvanced = Boolean(api.marker?.AdvancedMarkerElement)

    for (const listing of points) {
      const position = { lat: listing.lat, lng: listing.lng }
      bounds.extend(position)
      const label = priceLabel(listing)

      let marker: GMarkerLike
      if (useAdvanced && api.marker) {
        marker = new api.marker.AdvancedMarkerElement({
          map,
          position,
          title: listing.title,
          content: makePill(label),
        })
      } else {
        // Classic Marker fallback: burgundy dot + price text label.
        marker = new api.Marker({
          map,
          position,
          title: listing.title,
          label: {
            text: label,
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '12px',
          },
          icon: {
            path: 0, // google.maps.SymbolPath.CIRCLE
            fillColor: COLORS.burgundy,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 16,
          },
        })
      }

      marker.addListener('click', () => {
        info.setContent(infoHtml(listing, perNightLabel))
        info.open({ map, anchor: marker })
      })
      markersRef.current.push(marker)
    }

    // Frame the markers.
    if (!bounds.isEmpty()) {
      if (points.length === 1) {
        map.setCenter({ lat: points[0].lat, lng: points[0].lng })
        map.setZoom(11)
      } else {
        map.fitBounds(bounds, 48)
      }
    }
  }

  // Boot the map once the API is available.
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps(apiKey)
      .then((api) => {
        if (cancelled || !containerRef.current) return
        apiRef.current = api
        if (!mapRef.current) {
          const center =
            points.length > 0
              ? { lat: points[0].lat, lng: points[0].lng }
              : { lat: 20, lng: 0 }
          mapRef.current = new api.Map(containerRef.current, {
            center,
            zoom: points.length > 0 ? 5 : 2,
            // mapId is required for AdvancedMarkerElement; DEMO_MAP_ID works
            // without extra cloud config for prototypes.
            mapId: 'DEMO_MAP_ID',
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          })
        }
        renderMarkers(api, mapRef.current)
      })
      .catch((err) => {
        console.error('Google Maps init failed:', err)
      })
    return () => {
      cancelled = true
    }
    // Markers are rebuilt whenever the point set changes (pointsKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, pointsKey])

  // Clean up markers/InfoWindow on unmount (e.g. List/Map toggle).
  useEffect(() => {
    return () => {
      for (const m of markersRef.current) m.setMap(null)
      markersRef.current = []
      infoRef.current?.close()
    }
  }, [])

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
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
