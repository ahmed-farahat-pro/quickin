'use client'

// Incoming reservations for the host: fetches GET /api/local/host/bookings and
// renders each request with Approve / Decline buttons that PATCH
// /api/local/bookings/[id] { status: 'confirm' | 'reject' } and refresh the list.
import { useCallback, useEffect, useState } from 'react'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

interface HostBooking {
  id: string
  check_in: string
  check_out: string
  guests: number
  total_price: number
  status: string
  payment_status: 'paid' | 'unpaid'
  created_at: string
  guest_name: string | null
  listing_title: string | null
  title?: string
}

function statusChip(status: string, paid: boolean): { bg: string; fg: string; label: string } {
  switch (status) {
    case 'pending':   return { bg: '#fff7e6', fg: '#9a6b00', label: 'Awaiting your reply' }
    case 'confirmed': return { bg: '#e7f5ec', fg: '#177245', label: paid ? 'Approved & paid' : 'Approved' }
    case 'cancelled': return { bg: '#f1efec', fg: C.muted,   label: 'Cancelled' }
    case 'rejected':  return { bg: '#fdecea', fg: '#b3261e', label: 'Declined' }
    default:          return { bg: '#f1efec', fg: C.muted,   label: status || '—' }
  }
}

function fmtDate(d: string): string {
  const date = new Date(d + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return d
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 20,
  border: '1px solid rgba(42,34,32,0.06)',
  boxShadow: '0 6px 24px rgba(42,34,32,0.07)',
  padding: '18px 20px',
}

export function HostReservations() {
  const [bookings, setBookings] = useState<HostBooking[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/local/host/bookings', { credentials: 'same-origin' })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Failed to load reservations')
      }
      const data = await res.json()
      setBookings(Array.isArray(data.bookings) ? data.bookings : [])
    } catch (e) {
      setBookings([])
      setError(e instanceof Error ? e.message : 'Failed to load reservations')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function decide(id: string, status: 'confirm' | 'reject') {
    setBusyId(id)
    setRowError(null)
    try {
      const res = await fetch(`/api/local/bookings/${id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Could not update this reservation')
      }
      await load()
    } catch (e) {
      setRowError({ id, msg: e instanceof Error ? e.message : 'Could not update this reservation' })
    } finally {
      setBusyId(null)
    }
  }

  if (bookings === null) {
    return <p style={{ fontSize: 14, color: C.muted }}>Loading reservations…</p>
  }

  if (error && bookings.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', color: C.muted }}>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#b3261e' }}>{error}</p>
        <button onClick={load} style={ghostBtn}>Try again</button>
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', color: C.muted, padding: '40px 24px' }}>
        <p style={{ margin: 0, fontSize: 15 }}>No reservation requests yet.</p>
        <p style={{ margin: '6px 0 0', fontSize: 13.5 }}>
          Requests for your listings will show up here.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {bookings.map((b) => {
        const chip = statusChip(b.status, b.payment_status === 'paid')
        return (
          <article key={b.id} style={card}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: C.ink }}>
                  {b.listing_title || b.title || 'Listing'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: C.muted }}>
                  {b.guest_name || 'A guest'} · {b.guests} {b.guests === 1 ? 'guest' : 'guests'}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: C.ink }}>
                  {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-block',
                    background: chip.bg,
                    color: chip.fg,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 999,
                  }}
                >
                  {chip.label}
                </span>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: C.burgundy }}>
                  {b.total_price}
                </div>
                <div style={{ fontSize: 12.5, color: C.muted }}>total</div>
              </div>
            </div>

            {b.status === 'pending' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button
                  onClick={() => decide(b.id, 'confirm')}
                  disabled={busyId === b.id}
                  style={{
                    background: C.burgundy,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 999,
                    padding: '9px 22px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: busyId === b.id ? 'default' : 'pointer',
                    opacity: busyId === b.id ? 0.7 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {busyId === b.id ? 'Working…' : 'Approve'}
                </button>
                <button
                  onClick={() => decide(b.id, 'reject')}
                  disabled={busyId === b.id}
                  style={{
                    background: '#fff',
                    color: '#b3261e',
                    border: '1px solid rgba(179,38,30,0.4)',
                    borderRadius: 999,
                    padding: '9px 22px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: busyId === b.id ? 'default' : 'pointer',
                    opacity: busyId === b.id ? 0.7 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  Decline
                </button>
              </div>
            )}

            {rowError?.id === b.id && (
              <p style={{ margin: '10px 0 0', fontSize: 13, color: '#b3261e' }}>{rowError.msg}</p>
            )}
          </article>
        )
      })}
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  background: '#fff',
  color: C.burgundy,
  border: `1px solid ${C.tan}`,
  borderRadius: 999,
  padding: '8px 18px',
  fontWeight: 700,
  fontSize: 13.5,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
