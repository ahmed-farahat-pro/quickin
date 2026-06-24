'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatPrice } from '@/lib/utils'

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
  const t = useTranslations('listingPage')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [pets, setPets] = useState(0)
  const guests = adults + children // total headcount (infants/pets don't count)
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
          adults,
          children,
          infants,
          pets,
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
        message: data.error || t('errors.generic'),
      })
    } catch {
      setStatus({
        kind: 'error',
        message: t('errors.network'),
      })
    }
  }

  const canReserve =
    nights > 0 && guests >= 1 && status.kind !== 'loading'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.burgundy }}>
          {formatPrice(pricePerNight, currency)}
        </span>
        <span style={{ fontSize: 15, color: COLORS.muted }}>{t('perNight')}</span>
      </div>
      <p style={{ margin: '6px 0 18px', fontSize: 13, color: COLORS.muted }}>
        {t('pricesIn', { currency })}
      </p>

      {/* Date inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label htmlFor="rp-checkin" style={labelStyle}>
            {t('checkIn')}
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
            {t('checkOut')}
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
        <label style={labelStyle}>{t('guests')}</label>
        <div style={{ border: `1px solid rgba(42,34,32,0.14)`, borderRadius: 12, overflow: 'hidden' }}>
          <GuestRow label={t('guestTypes.adults')} sub={t('guestTypes.adultsSub')} value={adults} min={1} max={maxGuests || 16}
            onChange={(v) => { setAdults(v); setStatus({ kind: 'idle' }) }} />
          <GuestRow label={t('guestTypes.children')} sub={t('guestTypes.childrenSub')} value={children} min={0}
            max={maxGuests ? Math.max(0, maxGuests - adults) : 10}
            onChange={(v) => { setChildren(v); setStatus({ kind: 'idle' }) }} divider />
          <GuestRow label={t('guestTypes.infants')} sub={t('guestTypes.infantsSub')} value={infants} min={0} max={5}
            onChange={(v) => { setInfants(v); setStatus({ kind: 'idle' }) }} divider />
          <GuestRow label={t('guestTypes.pets')} sub={t('guestTypes.petsSub')} value={pets} min={0} max={5}
            onChange={(v) => { setPets(v); setStatus({ kind: 'idle' }) }} divider />
        </div>
        {maxGuests ? (
          <p style={{ margin: '6px 2px 0', fontSize: 12, color: COLORS.muted }}>
            {t('maxGuests', { count: maxGuests })}
          </p>
        ) : null}
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
            {formatPrice(pricePerNight, currency)} × {t('nightsCount', { nights })}
          </span>
          <span style={{ fontWeight: 700 }}>{formatPrice(total, currency)}</span>
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
          <span>{t('total')}</span>
          <span>{formatPrice(total, currency)}</span>
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
        {status.kind === 'loading' ? t('reserving') : t('reserve')}
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
          {t('pickDates')}
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
          {t('needsLogin')}{' '}
          <a
            href="/login"
            style={{ color: COLORS.burgundy, fontWeight: 700, textDecoration: 'none' }}
          >
            {t('logIn')}
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
            {t('success.title')} ⏳
          </strong>
          {t('success.summary', { nights: status.nights, total: status.total })}
          {' '}{t('success.awaitingApproval')}{' '}
          <a
            href="/reservations"
            style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline' }}
          >
            {t('success.viewReservations')}
          </a>
        </div>
      )}
    </div>
  )
}

function GuestRow({
  label, sub, value, min, max, onChange, divider,
}: {
  label: string
  sub: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  divider?: boolean
}) {
  const t = useTranslations('listingPage')
  const round = (enabled: boolean): React.CSSProperties => ({
    width: 30, height: 30, borderRadius: 999, border: `1px solid rgba(42,34,32,0.22)`,
    background: '#fff', color: enabled ? COLORS.burgundy : 'rgba(42,34,32,0.25)',
    fontSize: 18, lineHeight: 1, cursor: enabled ? 'pointer' : 'not-allowed',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  })
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 13px',
        borderTop: divider ? `1px solid rgba(42,34,32,0.10)` : undefined,
      }}
    >
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink }}>{label}</div>
        <div style={{ fontSize: 12, color: COLORS.muted }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" aria-label={t('decrease', { label })} disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))} style={round(value > min)}>−</button>
        <span style={{ minWidth: 16, textAlign: 'center', fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{value}</span>
        <button type="button" aria-label={t('increase', { label })} disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))} style={round(value < max)}>+</button>
      </div>
    </div>
  )
}
