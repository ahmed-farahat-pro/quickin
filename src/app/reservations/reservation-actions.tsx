'use client'

import { useState } from 'react'

const C = { burgundy: '#5B0F16', tan: '#EFE6D8', ink: '#2A2220', muted: '#6B6055' }

function statusChip(status: string): { bg: string; fg: string; label: string } {
  switch (status) {
    case 'pending':   return { bg: '#fff7e6', fg: '#9a6b00', label: 'Pending approval' }
    case 'confirmed': return { bg: '#e7f5ec', fg: '#177245', label: 'Confirmed' }
    case 'cancelled': return { bg: '#f1efec', fg: C.muted,   label: 'Cancelled' }
    case 'rejected':  return { bg: '#fdecea', fg: '#b3261e', label: 'Declined' }
    default:          return { bg: '#f1efec', fg: C.muted,   label: status || '—' }
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
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [reviewed, setReviewed] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const isPast = checkOut < today
  const isUpcoming = checkIn >= today
  const active = status !== 'cancelled' && status !== 'rejected'
  const chip = statusChip(status)

  async function cancel() {
    if (!confirm('Cancel this reservation? Any payment will be refunded per the policy.')) return
    setBusy(true); setNote(null)
    try {
      const res = await fetch(`/api/local/bookings/${bookingId}/cancel`, {
        method: 'POST', credentials: 'same-origin',
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Could not cancel')
      }
      window.location.reload()
    } catch (e) {
      setBusy(false)
      setNote(e instanceof Error ? e.message : 'Could not cancel')
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 12 }}>
      <span style={{ background: chip.bg, color: chip.fg, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
        {chip.label}
      </span>

      {active && isUpcoming && (
        <button onClick={cancel} disabled={busy} style={{ ...linkBtn, color: '#b3261e' }}>
          {busy ? 'Cancelling…' : 'Cancel'}
        </button>
      )}

      {status === 'confirmed' && isPast && !reviewed && (
        reviewing
          ? <ReviewForm bookingId={bookingId} onDone={() => { setReviewing(false); setReviewed(true) }} />
          : <button onClick={() => setReviewing(true)} style={linkBtn}>★ Leave a review</button>
      )}

      {reviewed && <span style={{ fontSize: 13, color: '#177245', fontWeight: 600 }}>Thanks for your review!</span>}
      {note && <span style={{ fontSize: 13, color: '#b3261e' }}>{note}</span>}
    </div>
  )
}

function ReviewForm({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
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
        throw new Error(e.error || 'Could not submit review')
      }
      onDone()
    } catch (e) {
      setBusy(false)
      setErr(e instanceof Error ? e.message : 'Could not submit review')
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
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            style={{ ...linkBtn, fontSize: 20, color: (hover || rating) >= n ? '#f5a623' : '#d8d2c8' }}
          >
            ★
          </button>
        ))}
      </div>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment (optional)"
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
        {busy ? 'Submitting…' : 'Submit'}
      </button>
      {err && <span style={{ fontSize: 13, color: '#b3261e' }}>{err}</span>}
    </div>
  )
}
