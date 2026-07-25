'use client'

// Host edit form: pre-filled from the listing, PATCHes the core fields to
// /api/local/listings/:id (server enforces ownership). Photos + the map pin are
// intentionally out of scope here — this covers the text/number details a host
// most often needs to fix. Mirrors the boutique inline-styled look of the
// create form (host/new/new-listing-form.tsx).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROPERTY_TYPES } from '@/lib/property-types'
import type { Listing } from '@/lib/local/db'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

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
const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

export function EditListingForm({ listing }: { listing: Listing }) {
  const router = useRouter()

  const [title, setTitle] = useState(listing.title ?? '')
  const [description, setDescription] = useState(listing.description ?? '')
  const [location, setLocation] = useState(listing.location ?? '')
  const [price, setPrice] = useState(listing.price_per_night != null ? String(listing.price_per_night) : '')
  const [weekendPrice, setWeekendPrice] = useState(listing.weekend_price != null ? String(listing.weekend_price) : '')
  const [currency, setCurrency] = useState(listing.currency ?? 'EGP')
  const [bedrooms, setBedrooms] = useState(String(listing.bedrooms ?? 1))
  const [beds, setBeds] = useState(String(listing.beds ?? 1))
  const [bathrooms, setBathrooms] = useState(String(listing.bathrooms ?? 1))
  const [maxGuests, setMaxGuests] = useState(String(listing.max_guests ?? 2))
  const [propertyType, setPropertyType] = useState(listing.property_type ?? 'Apartment')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Title is required')
      return
    }
    const priceNum = Number(price)
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError('Price per night must be greater than 0')
      return
    }
    const int = (v: string, d: number) => {
      const n = Math.floor(Number(v))
      return Number.isFinite(n) && n >= 0 ? n : d
    }
    const wk = Number(weekendPrice)

    setBusy(true)
    try {
      const res = await fetch(`/api/local/listings/${listing.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || null,
          location: location.trim() || null,
          price_per_night: priceNum,
          weekend_price: weekendPrice.trim() && Number.isFinite(wk) && wk > 0 ? wk : null,
          currency: currency.trim() || 'EGP',
          bedrooms: int(bedrooms, 1),
          beds: int(beds, 1),
          bathrooms: int(bathrooms, 1),
          max_guests: int(maxGuests, 2),
          property_type: propertyType || null,
        }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Could not save your changes')
      }
      setSaved(true)
      router.refresh()
      // Brief confirmation, then back to the host dashboard.
      setTimeout(() => router.push('/host'), 800)
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Could not save your changes')
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
      <div style={fieldWrap}>
        <label style={label} htmlFor="edit-title">Title</label>
        <input id="edit-title" style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="edit-desc">Description</label>
        <textarea
          id="edit-desc"
          style={{ ...input, minHeight: 110, resize: 'vertical' }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="edit-location">Location</label>
        <input id="edit-location" style={input} value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="edit-type">Property type</label>
        <select id="edit-type" style={input} value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
          {PROPERTY_TYPES.map((p) => (
            <option key={p.value} value={p.value}>{p.value}</option>
          ))}
        </select>
      </div>

      <div style={{ ...fieldWrap, ...row }}>
        <div>
          <label style={label} htmlFor="edit-price">Price / night</label>
          <input id="edit-price" style={input} type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="edit-weekend">Weekend price (optional)</label>
          <input id="edit-weekend" style={input} type="number" min="0" value={weekendPrice} onChange={(e) => setWeekendPrice(e.target.value)} />
        </div>
      </div>

      <div style={{ ...fieldWrap, ...row }}>
        <div>
          <label style={label} htmlFor="edit-currency">Currency</label>
          <input id="edit-currency" style={input} value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="edit-guests">Max guests</label>
          <input id="edit-guests" style={input} type="number" min="1" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} />
        </div>
      </div>

      <div style={{ ...fieldWrap, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={label} htmlFor="edit-bedrooms">Bedrooms</label>
          <input id="edit-bedrooms" style={input} type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="edit-beds">Beds</label>
          <input id="edit-beds" style={input} type="number" min="1" value={beds} onChange={(e) => setBeds(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="edit-baths">Bathrooms</label>
          <input id="edit-baths" style={input} type="number" min="1" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
        </div>
      </div>

      {error && (
        <p role="alert" style={{ margin: '0 0 14px', fontSize: 13.5, color: '#b3261e', fontWeight: 600 }}>
          {error}
        </p>
      )}
      {saved && (
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#177245', fontWeight: 700 }}>
          Saved ✓ Taking you back to your listings…
        </p>
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
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <a href="/host" style={{ color: C.muted, textDecoration: 'none', fontWeight: 600, fontSize: 14.5 }}>
          Cancel
        </a>
      </div>
    </form>
  )
}
