'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

const C = { burgundy: '#5B0F16', tan: '#EFE6D8', ink: '#2A2220', muted: '#6B6055' }

function statusChip(status: string): { bg: string; fg: string; labelKey: string } {
  switch (status) {
    case 'pending':   return { bg: '#fff7e6', fg: '#9a6b00', labelKey: 'status.pending' }
    case 'confirmed': return { bg: '#e7f5ec', fg: '#177245', labelKey: 'status.confirmed' }
    case 'cancelled': return { bg: '#f1efec', fg: C.muted,   labelKey: 'status.cancelled' }
    case 'rejected':  return { bg: '#fdecea', fg: '#b3261e', labelKey: 'status.rejected' }
    default:          return { bg: '#f1efec', fg: C.muted,   labelKey: '' }
  }
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: C.burgundy, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit',
}

/** Status chip + Cancel (upcoming) + Leave-a-review (past, confirmed) for one booking. */
export function ReservationActions(props: {
  bookingId: string
  status: string
  checkIn: string
  checkOut: string
}) {
  const { bookingId, status, checkIn, checkOut } = props
  const t = useTranslations('reservationsLocal')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [reviewed, setReviewed] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const isPast = checkOut < today
  const isUpcoming = checkIn >= today
  const active = status !== 'cancelled' && status !== 'rejected'
  const chip = statusChip(status)
  const chipLabel = chip.labelKey ? t(chip.labelKey) : (status || '—')

  async function cancel() {
    if (!confirm(t('confirmCancel'))) return
    setBusy(true); setNote(null)
    try {
      const res = await fetch(`/api/local/bookings/${bookingId}/cancel`, {
        method: 'POST', credentials: 'same-origin',
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || t('errors.cancelFailed'))
      }
      window.location.reload()
    } catch (e) {
      setBusy(false)
      setNote(e instanceof Error ? e.message : t('errors.cancelFailed'))
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 12 }}>
      <span style={{ background: chip.bg, color: chip.fg, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
        {chipLabel}
      </span>

      {active && isUpcoming && (
        <button onClick={cancel} disabled={busy} style={{ ...linkBtn, color: '#b3261e' }}>
          {busy ? t('cancelling') : t('cancel')}
        </button>
      )}

      {status === 'confirmed' && isPast && !reviewed && (
        reviewing
          ? <ReviewForm bookingId={bookingId} onDone={() => { setReviewing(false); setReviewed(true) }} />
          : <button onClick={() => setReviewing(true)} style={linkBtn}>★ {t('leaveReview')}</button>
      )}

      {reviewed && <span style={{ fontSize: 13, color: '#177245', fontWeight: 600 }}>{t('reviewThanks')}</span>}
      {note && <span style={{ fontSize: 13, color: '#b3261e' }}>{note}</span>}
    </div>
  )
}

function ReviewForm({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const t = useTranslations('reservationsLocal')
  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/local/reviews', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, rating, comment }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || t('errors.reviewFailed'))
      }
      onDone()
    } catch (e) {
      setBusy(false)
      setErr(e instanceof Error ? e.message : t('errors.reviewFailed'))
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={t('starRating', { count: n })}
            style={{ ...linkBtn, fontSize: 20, color: (hover || rating) >= n ? '#f5a623' : '#d8d2c8' }}
          >
            ★
          </button>
        ))}
      </div>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('commentPlaceholder')}
        style={{
          fontFamily: 'inherit', fontSize: 13.5, padding: '7px 11px', minWidth: 180,
          border: `1px solid ${C.tan}`, borderRadius: 10, background: '#fff', color: C.ink,
        }}
      />
      <button
        onClick={submit}
        disabled={busy}
        style={{ background: C.burgundy, color: '#fff', border: 'none', borderRadius: 10, padding: '7px 14px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
      >
        {busy ? t('submitting') : t('submit')}
      </button>
      {err && <span style={{ fontSize: 13, color: '#b3261e' }}>{err}</span>}
    </div>
  )
}
