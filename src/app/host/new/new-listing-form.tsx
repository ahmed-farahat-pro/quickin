'use client'

// Create-listing form: POSTs the listing fields to /api/local/listings (host_id
// is taken from the signed-in caller server-side) and on success navigates to
// /host. Location is set with a map pin; photos are uploaded from the device
// (camera or library) and sent as compressed base64 data URLs. The same uploader
// attaches the proof-of-ownership document (`ownership_doc`) an admin reviews
// before the listing goes live — parity with the iOS/Android add-listing flows.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { PROPERTY_TYPES, MAX_WEB_LISTING_PHOTOS } from '@/lib/property-types'
import { REGIONS, AMENITIES } from '@/lib/listing-options'
import { fileToCompressedDataUrl } from '@/lib/image'
import { DEFAULT_WEEKEND_DAYS } from '@/lib/geo'
import { OwnershipDocField } from '../ownership-doc'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const LocationPickerMap = dynamic(() => import('./location-picker-map'), {
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

export function NewListingForm() {
  const router = useRouter()
  const t = useTranslations('hostPage.create')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Controlled fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [country, setCountry] = useState('Egypt')
  const [region, setRegion] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [geo, setGeo] = useState<'idle' | 'locating' | 'fail'>('idle')
  const [placeResults, setPlaceResults] = useState<PlaceHit[]>([])
  const [placeOpen, setPlaceOpen] = useState(false)
  const placeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const placeAbortRef = useRef<AbortController | null>(null)
  const placeBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [price, setPrice] = useState('')
  const [weekendPrice, setWeekendPrice] = useState('')
  const [weekendDays, setWeekendDays] = useState<number[]>(DEFAULT_WEEKEND_DAYS)
  const [currency, setCurrency] = useState('EGP')
  const [bedrooms, setBedrooms] = useState('1')
  const [beds, setBeds] = useState('1')
  const [bathrooms, setBathrooms] = useState('1')
  const [maxGuests, setMaxGuests] = useState('2')
  const [propertyType, setPropertyType] = useState('Apartment')
  const [amenities, setAmenities] = useState<string[]>([])
  const [photos, setPhotos] = useState<string[]>([]) // base64 data URLs
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  // Proof of ownership — one compressed data URL, admin-only (never public).
  const [ownershipDoc, setOwnershipDoc] = useState('')

  function toggleWeekendDay(day: number) {
    setWeekendDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  function toggleAmenity(value: string) {
    setAmenities((prev) => (prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]))
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

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

    const num = (v: string, d: number) => {
      const n = Math.floor(Number(v))
      return Number.isFinite(n) && n >= 0 ? n : d
    }
    const wkNum = Number(weekendPrice)
    const weekend_price = weekendPrice.trim() && Number.isFinite(wkNum) && wkNum > 0 ? wkNum : undefined

    setBusy(true)
    try {
      const res = await fetch('/api/local/listings', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          country: country.trim() || undefined,
          lat: lat ?? undefined,
          lng: lng ?? undefined,
          price_per_night: priceNum,
          weekend_price,
          weekend_days: weekend_price ? weekendDays : undefined,
          currency: currency.trim() || 'EGP',
          bedrooms: num(bedrooms, 1),
          beds: num(beds, 1),
          bathrooms: num(bathrooms, 1),
          max_guests: num(maxGuests, 2),
          property_type: propertyType || undefined,
          region: region || undefined,
          amenities,
          images: photos,
          ownership_doc: ownershipDoc || undefined,
        }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || t('errors.createFailed'))
      }
      router.push('/host')
      router.refresh()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : t('errors.createFailed'))
    }
  }

  return (
    <form
      onSubmit={submit}
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
          .qk-new-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={fieldWrap}>
        <label style={label} htmlFor="title">{t('fields.title')}</label>
        <input
          id="title"
          style={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('placeholders.title')}
          required
        />
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="description">{t('fields.description')}</label>
        <textarea
          id="description"
          style={{ ...input, minHeight: 96, resize: 'vertical' }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('placeholders.description')}
        />
      </div>

      <div className="qk-new-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...fieldWrap }}>
        <div style={{ position: 'relative' }}>
          <label style={label} htmlFor="location">{t('fields.location')}</label>
          <input
            id="location"
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
          <label style={label} htmlFor="country">{t('fields.country')}</label>
          <select
            id="country"
            style={input}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Curated browse area — the chips guests filter by (same four on mobile). */}
      <div style={fieldWrap}>
        <label style={label} htmlFor="region">{t('fields.region')}</label>
        <select
          id="region"
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

      <div className="qk-new-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...fieldWrap }}>
        <div>
          <label style={label} htmlFor="price">{t('fields.price')}</label>
          <input
            id="price"
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
          <label style={label} htmlFor="currency">{t('fields.currency')}</label>
          <select
            id="currency"
            style={input}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Weekend pricing (optional, configurable days) */}
      <div style={fieldWrap}>
        <label style={label} htmlFor="weekendPrice">{t('fields.weekendPrice')}</label>
        <input
          id="weekendPrice"
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

      <div className="qk-new-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, ...fieldWrap }}>
        <div>
          <label style={label} htmlFor="bedrooms">{t('fields.bedrooms')}</label>
          <input id="bedrooms" style={input} type="number" min="0" step="1" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="beds">{t('fields.beds')}</label>
          <input id="beds" style={input} type="number" min="0" step="1" value={beds} onChange={(e) => setBeds(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="bathrooms">{t('fields.bathrooms')}</label>
          <input id="bathrooms" style={input} type="number" min="0" step="1" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="maxGuests">{t('fields.maxGuests')}</label>
          <input id="maxGuests" style={input} type="number" min="1" step="1" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} />
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
          {PROPERTY_TYPES.map((p) => {
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
                {t(`propertyTypes.${p.key}`)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Amenities — the same catalog (and the same stored values) as iOS/Android */}
      <div style={fieldWrap}>
        <label style={label}>{t('fields.amenities')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {AMENITIES.map((a) => {
            const on = amenities.includes(a.value)
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
                <Icon size={15} strokeWidth={1.9} />
                {t(`amenities.${a.key}`)}
              </button>
            )
          })}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: C.muted }}>{t('amenitiesHint')}</p>
      </div>

      {/* Photos — camera or library, compressed to base64, up to MAX_WEB_LISTING_PHOTOS */}
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
              gap: 10,
            }}
          >
            {photos.map((src, i) => (
              <div key={i} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', background: C.tan }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {i === 0 && (
                  <span style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(91,15,22,0.92)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999 }}>
                    {t('photosCover')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={t('photosRemove')}
                  style={{
                    position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 999,
                    border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 14, lineHeight: 1,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: C.muted }}>{t('photosHint')}</p>
      </div>

      {/* Ownership document — reviewed in /ops before the listing goes live. */}
      <OwnershipDocField
        value={ownershipDoc}
        onChange={setOwnershipDoc}
        onError={setError}
        idPrefix="new"
      />

      {error && (
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#b3261e', fontWeight: 600 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            background: C.burgundy,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '12px 30px',
            fontWeight: 700,
            fontSize: 15,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
            fontFamily: 'inherit',
          }}
        >
          {busy ? t('publishing') : t('publish')}
        </button>
        <a
          href="/host"
          style={{
            color: C.muted,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14.5,
          }}
        >
          {t('cancel')}
        </a>
      </div>
    </form>
  )
}
