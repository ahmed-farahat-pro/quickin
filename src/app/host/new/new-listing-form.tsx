'use client'

// Create-listing form: POSTs the listing fields to /api/local/listings (host_id
// is taken from the signed-in caller server-side) and on success navigates to
// /host. Images are entered as comma/newline-separated URLs.
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const PROPERTY_TYPES = [
  'Apartment',
  'House',
  'Villa',
  'Cabin',
  'Studio',
  'Loft',
  'Chalet',
  'Cottage',
  'Guest suite',
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

    const t = title.trim()
    if (!t) {
      setError('Please give your listing a title.')
      return
    }
    const priceNum = Number(price)
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError('Please enter a valid price per night.')
      return
    }

    const images = imagesText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)

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
          title: t,
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
        throw new Error(err.error || 'Could not create the listing')
      }
      router.push('/host')
      router.refresh()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Could not create the listing')
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
        <label style={label} htmlFor="title">Title</label>
        <input
          id="title"
          style={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sunlit loft by the Nile"
          required
        />
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="description">Description</label>
        <textarea
          id="description"
          style={{ ...input, minHeight: 96, resize: 'vertical' }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What makes your place special?"
        />
      </div>

      <div className="qk-new-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...fieldWrap }}>
        <div>
          <label style={label} htmlFor="location">Location</label>
          <input
            id="location"
            style={input}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Zamalek, Cairo"
          />
        </div>
        <div>
          <label style={label} htmlFor="country">Country</label>
          <input
            id="country"
            style={input}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Egypt"
          />
        </div>
      </div>

      <div className="qk-new-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...fieldWrap }}>
        <div>
          <label style={label} htmlFor="price">Price per night</label>
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
          <label style={label} htmlFor="currency">Currency</label>
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
          <label style={label} htmlFor="bedrooms">Bedrooms</label>
          <input id="bedrooms" style={input} type="number" min="0" step="1" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="beds">Beds</label>
          <input id="beds" style={input} type="number" min="0" step="1" value={beds} onChange={(e) => setBeds(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="bathrooms">Bathrooms</label>
          <input id="bathrooms" style={input} type="number" min="0" step="1" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="maxGuests">Max guests</label>
          <input id="maxGuests" style={input} type="number" min="1" step="1" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} />
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="propertyType">Property type</label>
        <select
          id="propertyType"
          style={{ ...input, appearance: 'auto' }}
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
        >
          {PROPERTY_TYPES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="images">Photo URLs</label>
        <textarea
          id="images"
          style={{ ...input, minHeight: 84, resize: 'vertical' }}
          value={imagesText}
          onChange={(e) => setImagesText(e.target.value)}
          placeholder="One URL per line, or comma-separated&#10;https://images.unsplash.com/photo-..."
        />
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.muted }}>
          Paste image links, separated by commas or new lines. The first one becomes the cover photo.
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
          {busy ? 'Publishing…' : 'Publish listing'}
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
          Cancel
        </a>
      </div>
    </form>
  )
}
