'use client'

import { useState } from 'react'

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: COLORS.muted,
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: FONT,
  color: COLORS.ink,
  background: '#fff',
  border: `1px solid rgba(42,34,32,0.14)`,
  borderRadius: 12,
  outline: 'none',
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'needsLogin' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; nights: number; total: number }

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0
  const a = new Date(checkIn + 'T00:00:00')
  const b = new Date(checkOut + 'T00:00:00')
  const ms = b.getTime() - a.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export default function ReservePanel({
  listingId,
  pricePerNight,
  currency,
  maxGuests,
}: {
  listingId: string
  pricePerNight: number
  currency: string
  maxGuests: number | null
}) {
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(1)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const nights = nightsBetween(checkIn, checkOut)
  const total = nights * pricePerNight

  async function handleReserve() {
    setStatus({ kind: 'loading' })
    try {
      const res = await fetch('/api/local/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          check_in: checkIn,
          check_out: checkOut,
          guests,
        }),
      })

      if (res.status === 401) {
        setStatus({ kind: 'needsLogin' })
        return
      }

      const data = await res.json().catch(() => ({}))

      if (res.status === 201) {
        setStatus({
          kind: 'success',
          nights: data.total_price && pricePerNight ? Math.round(data.total_price / pricePerNight) : nights,
          total: typeof data.total_price === 'number' ? data.total_price : total,
        })
        return
      }

      // 400 and anything else → surface the server error message.
      setStatus({
        kind: 'error',
        message: data.error || 'Something went wrong. Please try again.',
      })
    } catch {
      setStatus({
        kind: 'error',
        message: 'Network error. Please try again.',
      })
    }
  }

  const canReserve =
    nights > 0 && guests >= 1 && status.kind !== 'loading'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.burgundy }}>
          ${pricePerNight}
        </span>
        <span style={{ fontSize: 15, color: COLORS.muted }}>/ night</span>
      </div>
      <p style={{ margin: '6px 0 18px', fontSize: 13, color: COLORS.muted }}>
        Prices in {currency}
      </p>

      {/* Date inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label htmlFor="rp-checkin" style={labelStyle}>
            Check-in
          </label>
          <input
            id="rp-checkin"
            type="date"
            value={checkIn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setCheckIn(e.target.value)
              setStatus({ kind: 'idle' })
            }}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="rp-checkout" style={labelStyle}>
            Check-out
          </label>
          <input
            id="rp-checkout"
            type="date"
            value={checkOut}
            min={checkIn || new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setCheckOut(e.target.value)
              setStatus({ kind: 'idle' })
            }}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="rp-guests" style={labelStyle}>
          Guests
        </label>
        <input
          id="rp-guests"
          type="number"
          min={1}
          max={maxGuests || undefined}
          value={guests}
          onChange={(e) => {
            setGuests(Math.max(1, Number(e.target.value) || 1))
            setStatus({ kind: 'idle' })
          }}
          style={inputStyle}
        />
      </div>

      {/* Live total */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 16,
          borderTop: `1px solid rgba(42,34,32,0.10)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 14,
            color: COLORS.ink,
          }}
        >
          <span>
            ${pricePerNight} × {nights} {nights === 1 ? 'night' : 'nights'}
          </span>
          <span style={{ fontWeight: 700 }}>${total}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid rgba(42,34,32,0.10)`,
            fontSize: 16,
            fontWeight: 800,
            color: COLORS.burgundy,
          }}
        >
          <span>Total</span>
          <span>${total}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleReserve}
        disabled={!canReserve}
        style={{
          marginTop: 18,
          width: '100%',
          padding: '14px',
          fontSize: 16,
          fontWeight: 700,
          fontFamily: FONT,
          color: '#fff',
          background: COLORS.burgundy,
          border: 'none',
          borderRadius: 14,
          cursor: canReserve ? 'pointer' : 'not-allowed',
          opacity: canReserve ? 1 : 0.55,
        }}
      >
        {status.kind === 'loading' ? 'Reserving…' : 'Reserve'}
      </button>

      {nights === 0 && status.kind === 'idle' && (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 13,
            color: COLORS.muted,
            textAlign: 'center',
          }}
        >
          Pick your dates to see the total.
        </p>
      )}

      {/* Feedback */}
      {status.kind === 'needsLogin' && (
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: COLORS.tan,
            fontSize: 14,
            color: COLORS.ink,
          }}
        >
          Please sign in to reserve.{' '}
          <a
            href="/login"
            style={{ color: COLORS.burgundy, fontWeight: 700, textDecoration: 'none' }}
          >
            Log in
          </a>
        </div>
      )}

      {status.kind === 'error' && (
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(91,15,22,0.08)',
            border: `1px solid rgba(91,15,22,0.2)`,
            fontSize: 14,
            color: COLORS.burgundy,
            fontWeight: 600,
          }}
        >
          {status.message}
        </div>
      )}

      {status.kind === 'success' && (
        <div
          style={{
            marginTop: 14,
            padding: '14px 16px',
            borderRadius: 12,
            background: '#0f5132',
            color: '#fff',
            fontSize: 14,
          }}
        >
          <strong style={{ display: 'block', marginBottom: 4 }}>
            Request sent! ⏳
          </strong>
          {status.nights} {status.nights === 1 ? 'night' : 'nights'} · ${status.total} total.
          {' '}Awaiting host approval — you&apos;ll be notified once it&apos;s confirmed.{' '}
          <a
            href="/reservations"
            style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline' }}
          >
            View my reservations
          </a>
        </div>
      )}
    </div>
  )
}
