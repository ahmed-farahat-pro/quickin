'use client'

// Host edit form: pre-filled from the listing, PATCHes to /api/local/listings/:id
// (server enforces ownership). Deliberately mirrors host/new/new-listing-form.tsx
// field-for-field — same photo uploader, same currency/country selects, same
// property-type icon grid, same area + amenity catalogs, same place-search + map
// pin, same weekend-day pills — so hosts see one consistent listing form whether
// they're creating or editing. It also reuses the `hostPage.create.*` translations
// so both flows read alike.
//
// Two things are specific to editing:
//  1. It sends a PARTIAL patch — only the fields the host actually changed. That
//     keeps a listing holding a legacy value (say a property type the catalogs no
//     longer offer) editable, and keeps a text-only edit from re-uploading every
//     photo as base64.
//  2. Saving sends the listing BACK FOR REVIEW (approval_status='pending',
//     unpublished until an admin approves). That is a heavy, destructive-feeling
//     side effect, so the host is told before they save, has to confirm, and sees
//     the resulting "Under review" chip afterwards.
import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { PROPERTY_TYPES, MAX_WEB_LISTING_PHOTOS, iconForPropertyType } from '@/lib/property-types'
import { REGIONS, AMENITIES } from '@/lib/listing-options'
import { fileToCompressedDataUrl } from '@/lib/image'
import { DEFAULT_WEEKEND_DAYS } from '@/lib/geo'
import { OwnershipDocField } from '../../ownership-doc'
import { ListingStatusChip } from '../../listing-status-chip'
import type { HostListingStatus } from '../../host-tabs'
import type { Listing } from '@/lib/local/db'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

// The pin picker is shared with the create form (client-only — Leaflet needs window).
const LocationPickerMap = dynamic(() => import('../../new/location-picker-map'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 260, borderRadius: 14, background: C.tan, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>…</div>
  ),
})

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 13.5,
  fontWeight: 700,
  color: C.ink,
  marginBottom: 6,
}

const input: React.CSSProperties = {
  width: '100%',
  fontFamily: 'inherit',
  fontSize: 14.5,
  padding: '11px 14px',
  border: `1px solid ${C.tan}`,
  borderRadius: 14,
  background: '#fff',
  color: C.ink,
  boxSizing: 'border-box',
}

const fieldWrap: React.CSSProperties = { marginBottom: 18 }

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// Egypt-first. `code` is the ISO country code used to scope map geocoding.
// Kept in step with the create form so both flows offer the same choices.
const COUNTRIES: { name: string; code: string }[] = [
  { name: 'Egypt', code: 'eg' },
  { name: 'Saudi Arabia', code: 'sa' },
  { name: 'United Arab Emirates', code: 'ae' },
  { name: 'Kuwait', code: 'kw' },
  { name: 'Qatar', code: 'qa' },
  { name: 'Bahrain', code: 'bh' },
  { name: 'Oman', code: 'om' },
  { name: 'Jordan', code: 'jo' },
  { name: 'Lebanon', code: 'lb' },
  { name: 'Morocco', code: 'ma' },
]

const CURRENCIES = ['EGP', 'USD', 'EUR', 'SAR', 'AED', 'GBP'] as const

interface PlaceHit {
  label: string // full display name (secondary line)
  short: string // concise "place, city" (primary line + what we store)
  lat: number
  lon: number
}

// A concise "place, city" label from a Nominatim (jsonv2 + addressdetails) result.
function placeShort(d: { name?: string; display_name?: string; address?: Record<string, string> }): string {
  const a = d.address || {}
  const primary =
    d.name ||
    a.suburb || a.neighbourhood || a.city_district ||
    a.city || a.town || a.village ||
    String(d.display_name || '').split(',')[0]
  const city = a.city || a.town || a.village || a.state
  if (primary && city && primary !== city) return `${primary}, ${city}`
  return (primary || String(d.display_name || '').split(',').slice(0, 2).join(', ')).trim()
}

const dropdownStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: '4px 0 0',
  padding: 4,
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 50,
  background: '#fff',
  border: `1px solid ${C.tan}`,
  borderRadius: 12,
  boxShadow: '0 12px 30px rgba(42,34,32,0.14)',
  maxHeight: 260,
  overflowY: 'auto',
}

/** Legacy rows have no approval_status — treat anything unknown as published
 *  (same rule as the host dashboard's listingStatus). */
function statusOf(approval: string | null | undefined): HostListingStatus {
  return approval === 'pending' || approval === 'rejected' ? approval : 'approved'
}

/** Same members, ignoring order — amenities are a set, not a sequence. */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const norm = (list: readonly string[]) => [...list].map((s) => s.toLowerCase()).sort()
  const [x, y] = [norm(a), norm(b)]
  return x.every((v, i) => v === y[i])
}

export function EditListingForm({
  listing,
  hasOwnershipDoc,
}: {
  listing: Listing
  /** A proof-of-ownership document is already stored for this listing. Its bytes
   *  stay admin-only, so the host only ever sees this flag. */
  hasOwnershipDoc: boolean
}) {
  const router = useRouter()
  const t = useTranslations('hostPage.create')
  const tEdit = useTranslations('hostPage.edit')
  // The chips the host already knows from their listings screen.
  const tDash = useTranslations('hostPage.dashboard')

  const [title, setTitle] = useState(listing.title ?? '')
  const [description, setDescription] = useState(listing.description ?? '')
  const [location, setLocation] = useState(listing.location ?? '')
  const [country, setCountry] = useState(listing.country?.trim() || 'Egypt')
  const [region, setRegion] = useState(listing.region?.trim() || '')
  const [lat, setLat] = useState<number | null>(listing.lat ?? null)
  const [lng, setLng] = useState<number | null>(listing.lng ?? null)
  const [geo, setGeo] = useState<'idle' | 'locating' | 'fail'>('idle')
  const [placeResults, setPlaceResults] = useState<PlaceHit[]>([])
  const [placeOpen, setPlaceOpen] = useState(false)
  const placeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const placeAbortRef = useRef<AbortController | null>(null)
  const placeBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [price, setPrice] = useState(listing.price_per_night != null ? String(listing.price_per_night) : '')
  const [weekendPrice, setWeekendPrice] = useState(listing.weekend_price != null ? String(listing.weekend_price) : '')
  const [weekendDays, setWeekendDays] = useState<number[]>(listing.weekend_days ?? DEFAULT_WEEKEND_DAYS)
  const [currency, setCurrency] = useState(listing.currency?.trim() || 'EGP')
  const [bedrooms, setBedrooms] = useState(String(listing.bedrooms ?? 1))
  const [beds, setBeds] = useState(String(listing.beds ?? 1))
  const [bathrooms, setBathrooms] = useState(String(listing.bathrooms ?? 1))
  const [maxGuests, setMaxGuests] = useState(String(listing.max_guests ?? 2))
  const [propertyType, setPropertyType] = useState(listing.property_type ?? 'Apartment')
  const [amenities, setAmenities] = useState<string[]>(listing.amenities ?? [])
  // Existing photos come back ordered; index 0 is the cover. New device uploads
  // are appended as compressed base64 data URLs — the API accepts both forms.
  const initialPhotos = useMemo<string[]>(
    () =>
      [...(listing.listing_images ?? [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((img) => img.url)
        .filter(Boolean),
    [listing.listing_images]
  )
  const [photos, setPhotos] = useState<string[]>(initialPhotos)
  // Existing web uploads are stored as base64 data URLs, so re-sending an
  // unchanged set on a text-only edit can push the PATCH past the ~4.5MB body
  // limit and fail the save. Only send `images` when the set actually changed
  // (updateListing leaves photos untouched when the key is omitted).
  const photosDirty =
    photos.length !== initialPhotos.length ||
    photos.some((url, i) => url !== initialPhotos[i])
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  // A freshly-picked ownership document. Only sent when the host actually
  // replaces it, because submitting one re-queues the listing for review.
  const [ownershipDoc, setOwnershipDoc] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Two-step save: the host confirms the listing goes back for review.
  const [confirming, setConfirming] = useState(false)
  // The approval status the API returned after a successful save ('pending').
  const [savedStatus, setSavedStatus] = useState<HostListingStatus | null>(null)

  const currentStatus = statusOf(listing.approval_status)
  const statusLabel: Record<HostListingStatus, string> = {
    approved: tDash('filters.published'),
    pending: tDash('badge.pending'),
    rejected: tDash('badge.rejected'),
  }

  // Older listings may hold a value the standardised lists don't cover (the
  // currency used to be a free-text box). Surface it as an extra option so
  // switching to a <select> never silently rewrites the host's data.
  const countryOptions = COUNTRIES.some((c) => c.name === country)
    ? COUNTRIES
    : [...COUNTRIES, { name: country, code: '' }]
  const currencyOptions: string[] = (CURRENCIES as readonly string[]).includes(currency)
    ? [...CURRENCIES]
    : [...CURRENCIES, currency]
  // Same idea for the property-type grid: a type this listing already holds but
  // the grid doesn't offer (e.g. one created on mobile) still shows as selected.
  const propertyOptions = PROPERTY_TYPES.some((p) => p.value === propertyType)
    ? PROPERTY_TYPES
    : [...PROPERTY_TYPES, { value: propertyType, key: '', Icon: iconForPropertyType(propertyType) }]
  // …and for amenities saved elsewhere that aren't in the web catalog.
  const amenityOptions = [
    ...AMENITIES,
    ...amenities
      .filter((a) => !AMENITIES.some((c) => c.value.toLowerCase() === a.toLowerCase()))
      .map((a) => ({ value: a, key: '', Icon: null })),
  ]

  function toggleWeekendDay(day: number) {
    setWeekendDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  function toggleAmenity(value: string) {
    setAmenities((prev) =>
      prev.some((a) => a.toLowerCase() === value.toLowerCase())
        ? prev.filter((a) => a.toLowerCase() !== value.toLowerCase())
        : [...prev, value]
    )
  }

  // Forward-geocode the typed location (scoped to the chosen country) so the map
  // recenters + drops a pin there. The host can still tap/drag to fine-tune.
  async function geocodeLocation() {
    const q = location.trim()
    if (!q) return
    setGeo('locating')
    try {
      const code = COUNTRIES.find((c) => c.name === country)?.code
      const cc = code ? `&countrycodes=${code}` : ''
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1${cc}&q=${encodeURIComponent(q)}`
      )
      const data = await res.json()
      const hit = Array.isArray(data) ? data[0] : null
      if (hit?.lat && hit?.lon) {
        setLat(Number(hit.lat))
        setLng(Number(hit.lon))
        setGeo('idle')
      } else {
        setGeo('fail')
      }
    } catch {
      setGeo('fail')
    }
  }

  // Live place search (multiple results, scoped to the chosen country) so the
  // host can search a city/area and pick the right spot to pin — even when they
  // are physically somewhere else. Picking a result recenters the map + pins it.
  function runPlaceSearch(query: string) {
    placeAbortRef.current?.abort()
    const q = query.trim()
    if (q.length < 2) {
      setPlaceResults([])
      return
    }
    const controller = new AbortController()
    placeAbortRef.current = controller
    const code = COUNTRIES.find((c) => c.name === country)?.code
    const cc = code ? `&countrycodes=${code}` : ''
    fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6${cc}&q=${encodeURIComponent(q)}`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (controller.signal.aborted) return
        const arr = (Array.isArray(data) ? data : []) as Array<{
          display_name?: string; name?: string; lat?: string; lon?: string; address?: Record<string, string>
        }>
        const hits: PlaceHit[] = arr
          .map((d) => ({ label: String(d.display_name || ''), short: placeShort(d), lat: Number(d.lat), lon: Number(d.lon) }))
          .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon) && !!h.label)
        setPlaceResults(hits)
      })
      .catch((err) => {
        if ((err as Error)?.name !== 'AbortError') setPlaceResults([])
      })
  }

  function onLocationChange(value: string) {
    setLocation(value)
    setGeo('idle')
    setPlaceOpen(true)
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current)
    placeDebounceRef.current = setTimeout(() => runPlaceSearch(value), 300)
  }

  function pickPlace(h: PlaceHit) {
    setLocation(h.short || h.label)
    setLat(h.lat)
    setLng(h.lon)
    setGeo('idle')
    setPlaceResults([])
    setPlaceOpen(false)
  }

  // Clean up the debounce + in-flight search on unmount.
  useEffect(() => {
    return () => {
      if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current)
      if (placeBlurRef.current) clearTimeout(placeBlurRef.current)
      placeAbortRef.current?.abort()
    }
  }, [])

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-picking the same file
    if (!files.length) return
    const room = MAX_WEB_LISTING_PHOTOS - photos.length
    if (room <= 0) {
      setError(t('errors.tooManyPhotos', { max: MAX_WEB_LISTING_PHOTOS }))
      return
    }
    setPhotoBusy(true)
    setError(null)
    try {
      const picked = files.slice(0, room)
      const encoded: string[] = []
      for (const f of picked) {
        try {
          encoded.push(await fileToCompressedDataUrl(f))
        } catch {
          setError(t('errors.photoFailed'))
        }
      }
      setPhotos((prev) => [...prev, ...encoded].slice(0, MAX_WEB_LISTING_PHOTOS))
      if (files.length > room) setError(t('errors.tooManyPhotos', { max: MAX_WEB_LISTING_PHOTOS }))
    } finally {
      setPhotoBusy(false)
    }
  }

  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
  }

  /** Move a photo one slot earlier/later. Array order IS display order, so this
   *  is all "reorder" means — and moving to index 0 is what "set cover" does. */
  function movePhoto(from: number, to: number) {
    setPhotos((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  /**
   * Only the fields the host actually changed. The API treats an absent key as
   * "leave it alone", so a partial patch is both smaller and safer: values this
   * listing already holds are never re-validated, and photos (base64 data URLs)
   * only travel when the set changed. Returns null when nothing differs.
   */
  function buildPatch(): Record<string, unknown> | null {
    const patch: Record<string, unknown> = {}
    const text = (v: string) => v.trim()
    const int = (v: string, d: number) => {
      const n = Math.floor(Number(v))
      return Number.isFinite(n) && n >= 0 ? n : d
    }

    if (text(title) !== (listing.title ?? '').trim()) patch.title = text(title)
    if (text(description) !== (listing.description ?? '').trim()) patch.description = text(description) || null
    if (text(location) !== (listing.location ?? '').trim()) patch.location = text(location) || null
    if (text(country) !== (listing.country ?? '').trim()) patch.country = text(country) || null
    if (text(region) !== (listing.region ?? '').trim()) patch.region = text(region) || null
    if ((lat ?? null) !== (listing.lat ?? null)) patch.lat = lat ?? null
    if ((lng ?? null) !== (listing.lng ?? null)) patch.lng = lng ?? null

    const priceNum = Number(price)
    if (priceNum !== Number(listing.price_per_night)) patch.price_per_night = priceNum
    const wk = Number(weekendPrice)
    const nextWeekendPrice = weekendPrice.trim() && Number.isFinite(wk) && wk > 0 ? wk : null
    const weekendPriceChanged = nextWeekendPrice !== (listing.weekend_price ?? null)
    if (weekendPriceChanged) patch.weekend_price = nextWeekendPrice
    // Weekend days are only meaningful alongside a weekend price — they are
    // saved together, and cleared together.
    const nextWeekendDays = nextWeekendPrice ? weekendDays : null
    const currentWeekendDays = listing.weekend_days ?? null
    const daysChanged =
      (nextWeekendDays === null) !== (currentWeekendDays === null) ||
      (nextWeekendDays !== null &&
        currentWeekendDays !== null &&
        (nextWeekendDays.length !== currentWeekendDays.length ||
          nextWeekendDays.some((d, i) => d !== currentWeekendDays[i])))
    if (daysChanged) patch.weekend_days = nextWeekendDays
    if (text(currency) !== (listing.currency ?? '').trim()) patch.currency = text(currency) || 'EGP'

    if (int(bedrooms, 1) !== (listing.bedrooms ?? 1)) patch.bedrooms = int(bedrooms, 1)
    if (int(beds, 1) !== (listing.beds ?? 1)) patch.beds = int(beds, 1)
    if (int(bathrooms, 1) !== (listing.bathrooms ?? 1)) patch.bathrooms = int(bathrooms, 1)
    if (int(maxGuests, 2) !== (listing.max_guests ?? 2)) patch.max_guests = int(maxGuests, 2)
    if (propertyType !== (listing.property_type ?? '')) patch.property_type = propertyType || null
    if (!sameSet(amenities, listing.amenities ?? [])) patch.amenities = amenities

    // Full ordered set — the form owns photos, so this replaces them.
    if (photosDirty) patch.images = photos
    // Re-submitting proof of ownership sends the listing back for review.
    if (ownershipDoc) patch.ownership_doc = ownershipDoc

    return Object.keys(patch).length ? patch : null
  }

  const patch = buildPatch()
  const dirty = patch !== null

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (busy || savedStatus) return

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError(t('errors.titleRequired'))
      return
    }
    const priceNum = Number(price)
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError(t('errors.priceInvalid'))
      return
    }
    if (!dirty) return
    // Everything checks out — now tell the host what saving actually does.
    setConfirming(true)
  }

  async function save() {
    const body = buildPatch()
    if (!body) {
      setConfirming(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/local/listings/${listing.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || tEdit('errors.saveFailed'))
      }
      // Every mutation answers with the updated listing, so the new status is
      // shown straight away — no refetch.
      const updated = (await res.json().catch(() => null)) as Listing | null
      setBusy(false)
      setConfirming(false)
      setSavedStatus(statusOf(updated?.approval_status))
      router.refresh()
      // Long enough to read the "Under review" chip, then back to the listings
      // screen where the same chip + filter are waiting.
      setTimeout(() => router.push('/host'), 1800)
    } catch (err) {
      setBusy(false)
      setConfirming(false)
      setError(err instanceof Error ? err.message : tEdit('errors.saveFailed'))
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: '#fff',
        borderRadius: 24,
        border: `1px solid rgba(42,34,32,0.06)`,
        boxShadow: '0 6px 24px rgba(42,34,32,0.07)',
        padding: '28px 26px',
      }}
    >
      <style>{`
        @media (max-width: 560px) {
          .qk-edit-row { grid-template-columns: 1fr !important; }
        }
        /* Reorder arrows point the other way when the page is right-to-left. */
        [dir="rtl"] .qk-photo-move { transform: scaleX(-1); }
      `}</style>

      <div style={fieldWrap}>
        <label style={label} htmlFor="edit-title">{t('fields.title')}</label>
        <input
          id="edit-title"
          style={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('placeholders.title')}
          required
        />
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="edit-desc">{t('fields.description')}</label>
        <textarea
          id="edit-desc"
          style={{ ...input, minHeight: 96, resize: 'vertical' }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('placeholders.description')}
        />
      </div>

      <div className="qk-edit-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...fieldWrap }}>
        <div style={{ position: 'relative' }}>
          <label style={label} htmlFor="edit-location">{t('fields.location')}</label>
          <input
            id="edit-location"
            style={input}
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            onFocus={() => { if (location.trim().length >= 2) { setPlaceOpen(true); runPlaceSearch(location) } }}
            onBlur={() => {
              if (placeBlurRef.current) clearTimeout(placeBlurRef.current)
              placeBlurRef.current = setTimeout(() => setPlaceOpen(false), 150)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (placeResults[0]) pickPlace(placeResults[0])
                else geocodeLocation()
              } else if (e.key === 'Escape') {
                setPlaceOpen(false)
              }
            }}
            placeholder={t('placeholders.location')}
            autoComplete="off"
            role="combobox"
            aria-expanded={placeOpen}
          />
          {placeOpen && placeResults.length > 0 && (
            <ul style={dropdownStyle}>
              {placeResults.map((h, i) => (
                <li
                  key={`${h.lat},${h.lon},${i}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pickPlace(h)
                  }}
                  style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: C.ink }}>{h.short}</div>
                  <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.label}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: '6px 0 0', fontSize: 12, color: C.muted }}>{t('searchHint')}</p>
        </div>
        <div>
          <label style={label} htmlFor="edit-country">{t('fields.country')}</label>
          <select
            id="edit-country"
            style={input}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {countryOptions.map((c) => (
              <option key={c.code || c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Curated browse area — the chips guests filter by (same four on mobile). */}
      <div style={fieldWrap}>
        <label style={label} htmlFor="edit-region">{t('fields.region')}</label>
        <select
          id="edit-region"
          style={input}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="">{t('regionNone')}</option>
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value}>{t(`regions.${r.key}`)}</option>
          ))}
        </select>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.muted }}>{t('regionHint')}</p>
      </div>

      {/* Map pin — sets lat/lng; guests see an approximate area, not the exact pin. */}
      <div style={fieldWrap}>
        <label style={label}>{t('fields.pinLocation')}</label>
        <LocationPickerMap lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} />
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: geo === 'fail' ? C.burgundy : C.muted }}>
          {geo === 'locating'
            ? t('locating')
            : geo === 'fail'
            ? t('geocodeFail')
            : lat != null && lng != null
            ? t('pinSet', { lat: lat.toFixed(4), lng: lng.toFixed(4) })
            : t('pinHint')}
        </p>
      </div>

      <div className="qk-edit-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...fieldWrap }}>
        <div>
          <label style={label} htmlFor="edit-price">{t('fields.price')}</label>
          <input
            id="edit-price"
            style={input}
            type="number"
            min="1"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="1200"
            required
          />
        </div>
        <div>
          <label style={label} htmlFor="edit-currency">{t('fields.currency')}</label>
          <select
            id="edit-currency"
            style={input}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencyOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Weekend pricing (optional, configurable days) */}
      <div style={fieldWrap}>
        <label style={label} htmlFor="edit-weekend">{t('fields.weekendPrice')}</label>
        <input
          id="edit-weekend"
          style={input}
          type="number"
          min="0"
          step="1"
          value={weekendPrice}
          onChange={(e) => setWeekendPrice(e.target.value)}
          placeholder={t('placeholders.weekendPrice')}
        />
        <p style={{ margin: '8px 0 8px', fontSize: 12.5, color: C.muted }}>{t('fields.weekendDays')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {WEEKDAY_KEYS.map((k, day) => {
            const on = weekendDays.includes(day)
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleWeekendDay(day)}
                aria-pressed={on}
                style={{
                  padding: '7px 12px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  border: `1px solid ${on ? C.burgundy : 'rgba(42,34,32,0.16)'}`,
                  background: on ? C.burgundy : '#fff',
                  color: on ? '#fff' : C.ink,
                }}
              >
                {t(`weekdays.${k}`)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="qk-edit-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, ...fieldWrap }}>
        <div>
          <label style={label} htmlFor="edit-bedrooms">{t('fields.bedrooms')}</label>
          <input id="edit-bedrooms" style={input} type="number" min="0" step="1" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="edit-beds">{t('fields.beds')}</label>
          <input id="edit-beds" style={input} type="number" min="0" step="1" value={beds} onChange={(e) => setBeds(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="edit-baths">{t('fields.bathrooms')}</label>
          <input id="edit-baths" style={input} type="number" min="0" step="1" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="edit-guests">{t('fields.maxGuests')}</label>
          <input id="edit-guests" style={input} type="number" min="1" step="1" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} />
        </div>
      </div>

      {/* Property type — icon grid */}
      <div style={fieldWrap}>
        <label style={label}>{t('fields.propertyType')}</label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
            gap: 10,
          }}
        >
          {propertyOptions.map((p) => {
            const on = propertyType === p.value
            const Icon = p.Icon
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPropertyType(p.value)}
                aria-pressed={on}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 7,
                  padding: '14px 8px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: `1px solid ${on ? C.burgundy : 'rgba(42,34,32,0.14)'}`,
                  background: on ? 'rgba(91,15,22,0.06)' : '#fff',
                  color: on ? C.burgundy : C.ink,
                }}
              >
                <Icon size={22} strokeWidth={1.8} color={on ? C.burgundy : C.muted} />
                {p.key ? t(`propertyTypes.${p.key}`) : p.value}
              </button>
            )
          })}
        </div>
      </div>

      {/* Amenities — the same catalog (and the same stored values) as iOS/Android */}
      <div style={fieldWrap}>
        <label style={label}>{t('fields.amenities')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {amenityOptions.map((a) => {
            const on = amenities.some((x) => x.toLowerCase() === a.value.toLowerCase())
            const Icon = a.Icon
            return (
              <button
                key={a.value}
                type="button"
                onClick={() => toggleAmenity(a.value)}
                aria-pressed={on}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 14px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                  border: `1px solid ${on ? C.burgundy : 'rgba(42,34,32,0.16)'}`,
                  background: on ? C.burgundy : '#fff',
                  color: on ? '#fff' : C.ink,
                }}
              >
                {Icon && <Icon size={15} strokeWidth={1.9} />}
                {a.key ? t(`amenities.${a.key}`) : a.value}
              </button>
            )
          })}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: C.muted }}>{t('amenitiesHint')}</p>
      </div>

      {/* Photos — add, remove, reorder and pick the cover, up to MAX_WEB_LISTING_PHOTOS */}
      <div style={fieldWrap}>
        <label style={label}>{t('fields.photos')}</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={onPickFiles}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy || photos.length >= MAX_WEB_LISTING_PHOTOS}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              border: `1px solid ${C.tan}`,
              background: C.cream,
              color: C.burgundy,
              fontWeight: 700,
              fontSize: 14,
              fontFamily: 'inherit',
              cursor: photoBusy || photos.length >= MAX_WEB_LISTING_PHOTOS ? 'default' : 'pointer',
              opacity: photoBusy || photos.length >= MAX_WEB_LISTING_PHOTOS ? 0.6 : 1,
            }}
          >
            {photoBusy ? t('photosProcessing') : t('photosCta')}
          </button>
          <span style={{ fontSize: 12.5, color: C.muted }}>
            {t('photosCount', { count: photos.length, max: MAX_WEB_LISTING_PHOTOS })}
          </span>
        </div>

        {photos.length > 0 && (
          <div
            style={{
              marginTop: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
              gap: 10,
            }}
          >
            {photos.map((src, i) => (
              <div key={`${i}-${src.slice(0, 32)}`} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', background: C.tan }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {i === 0 && (
                  <span style={{ position: 'absolute', top: 6, insetInlineStart: 6, background: 'rgba(91,15,22,0.92)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999 }}>
                    {t('photosCover')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={t('photosRemove')}
                  style={{
                    position: 'absolute', top: 5, insetInlineEnd: 5, width: 22, height: 22, borderRadius: 999,
                    border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 14, lineHeight: 1,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ×
                </button>
                {/* Reorder + cover controls. Order in this array IS display order,
                    so moving a photo to the front is exactly "make it the cover". */}
                <div
                  style={{
                    position: 'absolute', insetInline: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    padding: '5px 4px', background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%)',
                  }}
                >
                  <PhotoControl
                    label={t('photosMoveEarlier')}
                    disabled={i === 0}
                    onClick={() => movePhoto(i, i - 1)}
                    glyph="‹"
                  />
                  {i !== 0 && (
                    <PhotoControl
                      label={t('photosSetCover')}
                      onClick={() => movePhoto(i, 0)}
                      glyph="★"
                      wide
                    />
                  )}
                  <PhotoControl
                    label={t('photosMoveLater')}
                    disabled={i === photos.length - 1}
                    onClick={() => movePhoto(i, i + 1)}
                    glyph="›"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: C.muted }}>{t('photosReorderHint')}</p>
      </div>

      {/* Ownership document — uploading a new one re-queues the listing for review. */}
      <OwnershipDocField
        value={ownershipDoc}
        onChange={setOwnershipDoc}
        onError={setError}
        idPrefix="edit"
        hasExistingDoc={hasOwnershipDoc}
      />

      {error && (
        <p role="alert" style={{ margin: '0 0 14px', fontSize: 13.5, color: '#b3261e', fontWeight: 600 }}>
          {error}
        </p>
      )}

      {/* What saving actually does — shown BEFORE the host commits to it. */}
      {!savedStatus && (
        <div
          style={{
            margin: '0 0 18px',
            background: '#fff7e6',
            border: '1px solid rgba(154,107,0,0.28)',
            borderRadius: 16,
            padding: '14px 16px',
          }}
        >
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#8a6d1b' }}>
            {tEdit('reviewWarning.title')}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.55, color: C.ink }}>
            {tEdit('reviewWarning.body')}
          </p>
        </div>
      )}

      {/* Saved: the same "Under review" chip the listings screen shows. */}
      {savedStatus && (
        <div
          role="status"
          style={{
            margin: '0 0 18px',
            background: C.cream,
            border: `1px solid ${C.tan}`,
            borderRadius: 16,
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#177245' }}>{tEdit('saved.title')}</span>
            <ListingStatusChip status={savedStatus} label={statusLabel[savedStatus]} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: C.ink }}>
            {savedStatus === 'pending' ? tEdit('saved.body') : tEdit('saved.bodyLive')}
          </p>
          <a href="/host" style={{ display: 'inline-block', marginTop: 10, color: C.burgundy, fontWeight: 700, fontSize: 13.5 }}>
            {tEdit('saved.cta')}
          </a>
        </div>
      )}

      {/* Two-step save: confirm the trip back through moderation. */}
      {confirming && !savedStatus && (
        <div
          style={{
            margin: '0 0 18px',
            background: '#fff',
            border: `1px solid ${C.burgundy}`,
            borderRadius: 16,
            padding: '16px 18px',
            boxShadow: '0 8px 24px rgba(91,15,22,0.10)',
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.burgundy }}>{tEdit('confirm.title')}</p>
          <p style={{ margin: '6px 0 14px', fontSize: 13.5, lineHeight: 1.55, color: C.ink }}>
            {tEdit('confirm.body')}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              style={{
                background: C.burgundy,
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '11px 24px',
                fontWeight: 700,
                fontSize: 14.5,
                fontFamily: 'inherit',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? tEdit('saving') : tEdit('confirm.cta')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              style={{
                background: '#fff',
                color: C.ink,
                border: `1px solid rgba(42,34,32,0.16)`,
                borderRadius: 999,
                padding: '11px 20px',
                fontWeight: 700,
                fontSize: 14.5,
                fontFamily: 'inherit',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              {tEdit('confirm.cancel')}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="submit"
          disabled={busy || !dirty || !!savedStatus}
          style={{
            background: C.burgundy,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '12px 30px',
            fontWeight: 700,
            fontSize: 15,
            cursor: busy || !dirty || savedStatus ? 'default' : 'pointer',
            opacity: busy || !dirty || savedStatus ? 0.55 : 1,
            fontFamily: 'inherit',
          }}
        >
          {busy ? tEdit('saving') : tEdit('save')}
        </button>
        <a href="/host" style={{ color: C.muted, textDecoration: 'none', fontWeight: 600, fontSize: 14.5 }}>
          {t('cancel')}
        </a>
        {!dirty && !savedStatus && (
          <span style={{ fontSize: 13, color: C.muted }}>{tEdit('noChanges')}</span>
        )}
      </div>
      {/* Where the listing stands right now, in the host's own vocabulary. */}
      {!savedStatus && (
        <p style={{ margin: '14px 0 0', fontSize: 12.5, color: C.muted, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {tEdit('statusLabel')}
          <ListingStatusChip status={currentStatus} label={statusLabel[currentStatus]} />
        </p>
      )}
    </form>
  )
}

/** One small overlay button on a photo tile (reorder / set cover). */
function PhotoControl({
  label,
  glyph,
  onClick,
  disabled = false,
  wide = false,
}: {
  label: string
  glyph: string
  onClick: () => void
  disabled?: boolean
  wide?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={wide ? undefined : 'qk-photo-move'}
      style={{
        minWidth: 22,
        height: 22,
        padding: wide ? '0 8px' : 0,
        borderRadius: 999,
        border: 'none',
        background: disabled ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.55)',
        color: '#fff',
        fontSize: 13,
        lineHeight: 1,
        fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {glyph}
    </button>
  )
}
