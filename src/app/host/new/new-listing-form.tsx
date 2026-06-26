'use client'

// Create-listing form: POSTs the listing fields to /api/local/listings (host_id
// is taken from the signed-in caller server-side) and on success navigates to
// /host. Images are entered as comma/newline-separated URLs.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

// Canonical (stored) value + its translation key. The value sent to the API
// stays English so existing data/filters keep working; only the label is i18n'd.
const PROPERTY_TYPES: { value: string; key: string }[] = [
  { value: 'Apartment', key: 'apartment' },
  { value: 'House', key: 'house' },
  { value: 'Villa', key: 'villa' },
  { value: 'Cabin', key: 'cabin' },
  { value: 'Studio', key: 'studio' },
  { value: 'Loft', key: 'loft' },
  { value: 'Chalet', key: 'chalet' },
  { value: 'Cottage', key: 'cottage' },
  { value: 'Guest suite', key: 'guestSuite' },
]

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

export function NewListingForm() {
  const router = useRouter()
  const t = useTranslations('hostPage.create')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Controlled fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [country, setCountry] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('EGP')
  const [bedrooms, setBedrooms] = useState('1')
  const [beds, setBeds] = useState('1')
  const [bathrooms, setBathrooms] = useState('1')
  const [maxGuests, setMaxGuests] = useState('2')
  const [propertyType, setPropertyType] = useState('Apartment')
  const [imagesText, setImagesText] = useState('')

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

    const images = imagesText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    // Validate each photo URL: must be an http(s) URL, ideally ending in a
    // plausible image extension (a bare http(s) URL is also accepted).
    const isImageUrl = (raw: string): boolean => {
      let u: URL
      try {
        u = new URL(raw)
      } catch {
        return false
      }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
      return true
    }
    const badUrl = images.find((u) => !isImageUrl(u))
    if (badUrl) {
      setError(t('errors.invalidImageUrl', { url: badUrl }))
      return
    }

    const num = (v: string, d: number) => {
      const n = Math.floor(Number(v))
      return Number.isFinite(n) && n >= 0 ? n : d
    }

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
          price_per_night: priceNum,
          currency: currency.trim() || 'EGP',
          bedrooms: num(bedrooms, 1),
          beds: num(beds, 1),
          bathrooms: num(bathrooms, 1),
          max_guests: num(maxGuests, 2),
          property_type: propertyType || undefined,
          images,
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
        <div>
          <label style={label} htmlFor="location">{t('fields.location')}</label>
          <input
            id="location"
            style={input}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('placeholders.location')}
          />
        </div>
        <div>
          <label style={label} htmlFor="country">{t('fields.country')}</label>
          <input
            id="country"
            style={input}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={t('placeholders.country')}
          />
        </div>
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
          <input
            id="currency"
            style={input}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="EGP"
            maxLength={6}
          />
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

      <div style={fieldWrap}>
        <label style={label} htmlFor="propertyType">{t('fields.propertyType')}</label>
        <select
          id="propertyType"
          style={{ ...input, appearance: 'auto' }}
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
        >
          {PROPERTY_TYPES.map((p) => (
            <option key={p.value} value={p.value}>{t(`propertyTypes.${p.key}`)}</option>
          ))}
        </select>
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="images">{t('fields.photos')}</label>
        <textarea
          id="images"
          style={{ ...input, minHeight: 84, resize: 'vertical' }}
          value={imagesText}
          onChange={(e) => setImagesText(e.target.value)}
          placeholder={t('placeholders.photos')}
        />
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.muted }}>
          {t('photosHint')}
        </p>
      </div>

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
