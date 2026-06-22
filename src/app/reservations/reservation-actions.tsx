'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

const C = { burgundy: '#5B0F16', tan: '#EFE6D8', ink: '#2A2220', muted: '#6B6055' }

function statusChip(status: string, paid: boolean): { bg: string; fg: string; labelKey: string } {
  switch (status) {
    case 'pending':   return { bg: '#fff7e6', fg: '#9a6b00', labelKey: 'waitingForApproval' }
    case 'confirmed': return { bg: '#e7f5ec', fg: '#177245', labelKey: paid ? 'paid' : 'approved' }
    case 'cancelled': return { bg: '#f1efec', fg: C.muted,   labelKey: 'status.cancelled' }
    case 'rejected':  return { bg: '#fdecea', fg: '#b3261e', labelKey: 'status.rejected' }
    default:          return { bg: '#f1efec', fg: C.muted,   labelKey: '' }
  }
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: C.burgundy, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit',
}

/** Status chip + Pay (confirmed & unpaid) + Cancel (upcoming) + Leave-a-review (past, confirmed) for one booking. */
export function ReservationActions(props: {
  bookingId: string
  status: string
  paid: boolean
  checkIn: string
  checkOut: string
}) {
  const { bookingId, status, paid, checkIn, checkOut } = props
  const t = useTranslations('reservationsLocal')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payErr, setPayErr] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const isPast = checkOut < today
  const isUpcoming = checkIn >= today
  const active = status !== 'cancelled' && status !== 'rejected'
  const chip = statusChip(status, paid)
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

  async function pay() {
    if (status !== 'confirmed' || paid) return
    setPaying(true); setPayErr(null)
    try {
      const res = await fetch(`/api/local/bookings/${bookingId}/pay`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'card' }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || t('payError'))
      }
      router.refresh()
    } catch (e) {
      setPaying(false)
      setPayErr(e instanceof Error ? e.message : t('payError'))
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 12 }}>
      <span style={{ background: chip.bg, color: chip.fg, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
        {chipLabel}
      </span>

      {status === 'confirmed' && paid && (
        <span style={{ background: '#e7f5ec', color: '#177245', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
          ✓ {t('paid')}
        </span>
      )}

      {status === 'confirmed' && !paid && (
        <button
          onClick={pay}
          disabled={paying}
          style={{ background: C.burgundy, color: '#fff', border: 'none', borderRadius: 10, padding: '7px 16px', fontWeight: 700, fontSize: 13.5, cursor: paying ? 'default' : 'pointer', opacity: paying ? 0.7 : 1, fontFamily: 'inherit' }}
        >
          {paying ? t('paying') : t('payNow')}
        </button>
      )}

      {status === 'pending' && (
        <span style={{ fontSize: 13, color: C.muted }}>{t('awaitingApproval')}</span>
      )}

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
      {payErr && <span style={{ fontSize: 13, color: '#b3261e' }}>{payErr}</span>}
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
