'use client'

// QuickIn — operations console (local-stack admin).
// Self-contained client page: operator types an admin key (stored in
// localStorage 'qk_ops_key', never hardcoded), then runs a full admin
// dashboard against the real (Neon) data — overview stats, users,
// listings (with publish/hide/delete), bookings, host applications and
// ID verifications. Every request is key-gated (?key= and x-admin-key).
import { useCallback, useEffect, useState } from 'react'

// Boutique palette.
const BURGUNDY = '#5B0F16'
const CREAM = '#F6F1E6'
const TAN = '#EFE6D8'
const INK = '#2A2220'
const MUTED = '#6B6055'
const GREEN = '#2E7D5B'
const KEY_STORAGE = 'qk_ops_key'

type TabId = 'overview' | 'users' | 'listings' | 'bookings' | 'applications' | 'verifications'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'listings', label: 'Listings' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'applications', label: 'Applications' },
  { id: 'verifications', label: 'Verifications' },
]

type AdminStats = {
  users: number
  hosts: number
  verified: number
  listings: number
  published: number
  bookings: number
  pending_bookings: number
  confirmed_bookings: number
  paid_bookings: number
  pending_applications: number
  pending_verifications: number
  gross_paid: number
}

type AdminUser = {
  id: string
  email: string
  full_name: string | null
  is_host: boolean
  verification_status: string
  email_verified: boolean
  created_at: string
  listing_count: number
  booking_count: number
}

type AdminListing = {
  id: string
  title: string
  location: string | null
  currency: string
  price_per_night: number
  is_published: boolean
  host_id: string | null
  host_name: string | null
  created_at: string
  booking_count: number
  image: string | null
}

type AdminBooking = {
  id: string
  reservation_code: string
  status: string
  payment_status: string
  total_price: number
  currency: string
  check_in: string
  check_out: string
  guest_name: string | null
  guest_email: string | null
  listing_title: string | null
  created_at: string
}

type HostApplication = {
  id: string
  user_id?: string | null
  email?: string | null
  full_name?: string | null
  national_id?: string | null
  phone?: string | null
  address?: string | null
  company?: string | null
  notes?: string | null
  status?: string | null
  submitted_at?: string | null
}

type Verification = {
  id: string
  user_id?: string | null
  email?: string | null
  full_name?: string | null
  id_number?: string | null
  status?: string | null
  image_data?: string | null
  submitted_at?: string | null
}

function fmtDate(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

function fmtDay(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString()
}

function fmtMoney(value: number, currency: string): string {
  const n = Number(value) || 0
  const formatted = n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return `${currency || 'USD'} ${formatted}`
}

export default function OpsPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<TabId>('overview')

  // Per-section data.
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [listings, setListings] = useState<AdminListing[]>([])
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [apps, setApps] = useState<HostApplication[]>([])
  const [verifs, setVerifs] = useState<Verification[]>([])

  // Per-section loading / error.
  const [loading, setLoading] = useState<Record<TabId, boolean>>({
    overview: false,
    users: false,
    listings: false,
    bookings: false,
    applications: false,
    verifications: false,
  })
  const [errors, setErrors] = useState<Record<TabId, string | null>>({
    overview: null,
    users: null,
    listings: null,
    bookings: null,
    applications: null,
    verifications: null,
  })
  const [loaded, setLoaded] = useState<Record<TabId, boolean>>({
    overview: false,
    users: false,
    listings: false,
    bookings: false,
    applications: false,
    verifications: false,
  })

  const [busyId, setBusyId] = useState<string | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)

  // Restore a previously-saved key on first mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_STORAGE)
      if (saved) setAdminKey(saved)
    } catch {
      /* localStorage may be unavailable */
    }
    setReady(true)
  }, [])

  const wrongKey = useCallback(() => {
    try {
      localStorage.removeItem(KEY_STORAGE)
    } catch {
      /* ignore */
    }
    setAdminKey(null)
    setStats(null)
    setUsers([])
    setListings([])
    setBookings([])
    setApps([])
    setVerifs([])
    setLoaded({
      overview: false,
      users: false,
      listings: false,
      bookings: false,
      applications: false,
      verifications: false,
    })
    setKeyError('Wrong key — please try again.')
  }, [])

  const setSectionLoading = (id: TabId, v: boolean) =>
    setLoading((prev) => ({ ...prev, [id]: v }))
  const setSectionError = (id: TabId, v: string | null) =>
    setErrors((prev) => ({ ...prev, [id]: v }))

  // Generic GET against a key-gated admin endpoint.
  const adminGet = useCallback(
    async <T,>(key: string, path: string): Promise<T | 'forbidden' | null> => {
      try {
        const res = await fetch(`/api/local/admin/${path}?key=${encodeURIComponent(key)}`, {
          headers: { 'x-admin-key': key },
          cache: 'no-store',
        })
        if (res.status === 403) return 'forbidden'
        if (!res.ok) return null
        return (await res.json()) as T
      } catch {
        return null
      }
    },
    [],
  )

  const loadSection = useCallback(
    async (id: TabId, key: string) => {
      setSectionLoading(id, true)
      setSectionError(id, null)
      try {
        if (id === 'overview') {
          const json = await adminGet<{ stats?: AdminStats }>(key, 'stats')
          if (json === 'forbidden') return wrongKey()
          if (!json || !json.stats) {
            setSectionError(id, 'Could not load stats. Please retry.')
            return
          }
          setStats(json.stats)
        } else if (id === 'users') {
          const json = await adminGet<{ users?: AdminUser[] }>(key, 'users')
          if (json === 'forbidden') return wrongKey()
          if (!json) {
            setSectionError(id, 'Could not load users. Please retry.')
            return
          }
          setUsers(Array.isArray(json.users) ? json.users : [])
        } else if (id === 'listings') {
          const json = await adminGet<{ listings?: AdminListing[] }>(key, 'listings')
          if (json === 'forbidden') return wrongKey()
          if (!json) {
            setSectionError(id, 'Could not load listings. Please retry.')
            return
          }
          setListings(Array.isArray(json.listings) ? json.listings : [])
        } else if (id === 'bookings') {
          const json = await adminGet<{ bookings?: AdminBooking[] }>(key, 'bookings')
          if (json === 'forbidden') return wrongKey()
          if (!json) {
            setSectionError(id, 'Could not load bookings. Please retry.')
            return
          }
          setBookings(Array.isArray(json.bookings) ? json.bookings : [])
        } else if (id === 'applications') {
          const json = await adminGet<{ applications?: HostApplication[] }>(key, 'host-applications')
          if (json === 'forbidden') return wrongKey()
          if (!json) {
            setSectionError(id, 'Could not load applications. Please retry.')
            return
          }
          setApps(Array.isArray(json.applications) ? json.applications : [])
        } else if (id === 'verifications') {
          const json = await adminGet<{ verifications?: Verification[] }>(key, 'verifications')
          if (json === 'forbidden') return wrongKey()
          if (!json) {
            setSectionError(id, 'Could not load verifications. Please retry.')
            return
          }
          setVerifs(Array.isArray(json.verifications) ? json.verifications : [])
        }
        setLoaded((prev) => ({ ...prev, [id]: true }))
      } finally {
        setSectionLoading(id, false)
      }
    },
    [adminGet, wrongKey],
  )

  // Lazy-fetch the active tab on first open.
  useEffect(() => {
    if (!adminKey) return
    if (!loaded[tab] && !loading[tab]) void loadSection(tab, adminKey)
  }, [adminKey, tab, loaded, loading, loadSection])

  const refresh = () => {
    if (adminKey) void loadSection(tab, adminKey)
  }

  const unlock = (e: React.FormEvent) => {
    e.preventDefault()
    const key = keyInput.trim()
    if (!key) return
    try {
      localStorage.setItem(KEY_STORAGE, key)
    } catch {
      /* ignore */
    }
    setKeyError(null)
    setAdminKey(key)
    setKeyInput('')
  }

  const lock = () => {
    try {
      localStorage.removeItem(KEY_STORAGE)
    } catch {
      /* ignore */
    }
    setAdminKey(null)
    setStats(null)
    setUsers([])
    setListings([])
    setBookings([])
    setApps([])
    setVerifs([])
    setLoaded({
      overview: false,
      users: false,
      listings: false,
      bookings: false,
      applications: false,
      verifications: false,
    })
    setKeyError(null)
  }

  // POST to a key-gated admin endpoint. Returns true on success.
  const post = async (path: string, body: Record<string, unknown>): Promise<boolean> => {
    if (!adminKey) return false
    try {
      const res = await fetch(`/api/local/admin/${path}?key=${encodeURIComponent(adminKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(body),
      })
      if (res.status === 403) {
        wrongKey()
        return false
      }
      return res.ok
    } catch {
      return false
    }
  }

  // ---- users actions ----
  const activateUser = async (u: AdminUser) => {
    setBusyId(u.id)
    const ok = await post('users', { id: u.id, action: 'activate' })
    setBusyId(null)
    if (ok) {
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, email_verified: true } : x)),
      )
    } else {
      setSectionError('users', 'Could not activate the user. Please retry.')
    }
  }

  const deleteUser = async (u: AdminUser) => {
    if (!window.confirm(`Permanently delete ${u.email}? This removes their account, listings and bookings and cannot be undone.`)) return
    setBusyId(u.id)
    const ok = await post('users', { id: u.id, action: 'delete' })
    setBusyId(null)
    if (ok) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
    } else {
      setSectionError('users', 'Could not delete the user. Please retry.')
    }
  }

  // ---- listings actions ----
  const togglePublish = async (l: AdminListing) => {
    setBusyId(l.id)
    const action = l.is_published ? 'unpublish' : 'publish'
    const ok = await post('listings', { id: l.id, action })
    setBusyId(null)
    if (ok) {
      setListings((prev) =>
        prev.map((x) => (x.id === l.id ? { ...x, is_published: !l.is_published } : x)),
      )
    } else {
      setSectionError('listings', 'Could not update the listing. Please retry.')
    }
  }

  const deleteListing = async (l: AdminListing) => {
    if (!window.confirm(`Delete listing "${l.title}"? This cannot be undone.`)) return
    setBusyId(l.id)
    const ok = await post('listings', { id: l.id, action: 'delete' })
    setBusyId(null)
    if (ok) {
      setListings((prev) => prev.filter((x) => x.id !== l.id))
    } else {
      setSectionError('listings', 'Could not delete the listing. Please retry.')
    }
  }

  // ---- applications / verifications actions ----
  const decideApp = async (id: string, action: 'approve' | 'reject') => {
    let note: string | null = null
    if (action === 'reject') {
      note = window.prompt('Optional note for the applicant (why declined):') ?? null
    }
    setBusyId(id)
    const ok = await post('host-applications', { id, action, note })
    setBusyId(null)
    if (ok) setApps((prev) => prev.filter((a) => a.id !== id))
  }

  const decideVerif = async (id: string, action: 'verify' | 'reject') => {
    let note: string | null = null
    if (action === 'reject') {
      note = window.prompt('Optional note (why rejected):') ?? null
    }
    setBusyId(id)
    const ok = await post('verifications', { id, action, note })
    setBusyId(null)
    if (ok) setVerifs((prev) => prev.filter((v) => v.id !== id))
  }

  // ---- styles ----
  const pageStyle: React.CSSProperties = {
    background: CREAM,
    minHeight: '100vh',
    color: INK,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  }
  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: `1px solid ${TAN}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: '0 1px 3px rgba(42,34,32,0.06)',
  }
  const btnBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 12,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  }
  const approveBtn: React.CSSProperties = { ...btnBase, background: GREEN, color: '#fff' }
  const outlineBtn: React.CSSProperties = {
    ...btnBase,
    background: 'transparent',
    color: BURGUNDY,
    border: `1px solid ${BURGUNDY}`,
  }
  const dangerBtn: React.CSSProperties = {
    ...btnBase,
    background: 'transparent',
    color: BURGUNDY,
    border: `1px solid ${BURGUNDY}`,
  }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: MUTED, marginBottom: 2 }
  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 12,
    color: MUTED,
    fontWeight: 600,
    padding: '8px 12px',
    borderBottom: `1px solid ${TAN}`,
    whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    fontSize: 13,
    padding: '10px 12px',
    borderBottom: `1px solid ${TAN}`,
    verticalAlign: 'middle',
  }

  const badge = (text: string, bg: string, color: string): React.ReactNode => (
    <span
      style={{
        display: 'inline-block',
        background: bg,
        color,
        borderRadius: 999,
        padding: '2px 10px',
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )

  const verificationBadge = (status: string): React.ReactNode => {
    const s = (status || 'none').toLowerCase()
    if (s === 'verified' || s === 'approved') return badge('Verified', '#E2F0E9', GREEN)
    if (s === 'pending') return badge('Pending', '#FBF1DD', '#8A6D1F')
    return badge('None', TAN, MUTED)
  }

  const statusBadge = (status: string): React.ReactNode => {
    const s = (status || '').toLowerCase()
    if (s === 'confirmed') return badge('Confirmed', '#E2F0E9', GREEN)
    if (s === 'pending') return badge('Pending', '#FBF1DD', '#8A6D1F')
    if (s === 'cancelled' || s === 'canceled') return badge('Cancelled', TAN, MUTED)
    if (s === 'rejected' || s === 'declined') return badge('Rejected', '#F6E0E2', BURGUNDY)
    return badge(status || '—', TAN, MUTED)
  }

  // Avoid SSR/client mismatch while reading localStorage.
  if (!ready) {
    return (
      <main style={pageStyle}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 20px', color: MUTED }}>
          Loading…
        </div>
      </main>
    )
  }

  // ---- locked: key prompt ----
  if (!adminKey) {
    return (
      <main style={pageStyle}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <form onSubmit={unlock} style={{ ...cardStyle, width: '100%', maxWidth: 380 }}>
            <h1 style={{ color: BURGUNDY, fontSize: 22, fontWeight: 700, margin: 0 }}>
              QuickIn — operations
            </h1>
            <p style={{ color: MUTED, fontSize: 13, margin: '8px 0 18px' }}>
              Enter the admin key to open the dashboard.
            </p>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Admin key"
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: `1px solid ${TAN}`,
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 15,
                marginBottom: 12,
                background: CREAM,
                color: INK,
              }}
            />
            {keyError ? (
              <p style={{ color: BURGUNDY, fontSize: 13, margin: '0 0 12px' }}>{keyError}</p>
            ) : null}
            <button
              type="submit"
              style={{ ...btnBase, background: BURGUNDY, color: '#fff', width: '100%' }}
            >
              Unlock
            </button>
          </form>
        </div>
      </main>
    )
  }

  const sectionLoading = loading[tab]
  const sectionError = errors[tab]

  // ---- unlocked: dashboard ----
  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 20px 64px' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <h1 style={{ color: BURGUNDY, fontSize: 26, fontWeight: 700, margin: 0 }}>
              QuickIn — operations
            </h1>
            <p style={{ color: MUTED, fontSize: 13, margin: '4px 0 0' }}>
              This console reads and writes <strong>live data</strong>. Actions take effect
              immediately.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={refresh} style={outlineBtn} disabled={sectionLoading}>
              {sectionLoading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button onClick={lock} style={outlineBtn}>
              Lock
            </button>
          </div>
        </header>

        {/* Tabs */}
        <nav
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            borderBottom: `1px solid ${TAN}`,
            paddingBottom: 12,
            marginBottom: 24,
          }}
        >
          {TABS.map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  ...btnBase,
                  background: active ? BURGUNDY : 'transparent',
                  color: active ? '#fff' : INK,
                  border: active ? `1px solid ${BURGUNDY}` : `1px solid ${TAN}`,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </nav>

        {sectionError ? (
          <p
            style={{
              color: BURGUNDY,
              background: TAN,
              border: `1px solid ${BURGUNDY}`,
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {sectionError}
          </p>
        ) : null}

        {sectionLoading && !loaded[tab] ? (
          <p style={{ color: MUTED, fontSize: 14, marginTop: 8 }}>Loading live data…</p>
        ) : null}

        {/* ===================== OVERVIEW ===================== */}
        {tab === 'overview' && loaded.overview ? (
          stats ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 14,
              }}
            >
              {[
                { label: 'Users', value: stats.users },
                { label: 'Hosts', value: stats.hosts },
                { label: 'Verified', value: stats.verified },
                { label: 'Listings', value: stats.listings },
                { label: 'Published', value: stats.published },
                { label: 'Bookings', value: stats.bookings },
                { label: 'Pending bookings', value: stats.pending_bookings },
                { label: 'Paid', value: stats.paid_bookings },
                {
                  label: 'Gross paid',
                  value: (Number(stats.gross_paid) || 0).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  }),
                },
                { label: 'Pending applications', value: stats.pending_applications },
                { label: 'Pending IDs', value: stats.pending_verifications },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: TAN,
                    border: `1px solid ${TAN}`,
                    borderRadius: 18,
                    padding: '18px 18px 16px',
                    boxShadow: '0 1px 3px rgba(42,34,32,0.06)',
                  }}
                >
                  <div style={{ fontSize: 30, fontWeight: 800, color: BURGUNDY, lineHeight: 1.1 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 6, fontWeight: 600 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: MUTED, fontSize: 14 }}>No stats available.</p>
          )
        ) : null}

        {/* ===================== USERS ===================== */}
        {tab === 'users' && loaded.users ? (
          users.length === 0 ? (
            <p style={{ color: MUTED, fontSize: 14 }}>No users.</p>
          ) : (
            <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Email status</th>
                    <th style={thStyle}>Verification</th>
                    <th style={thStyle}>Listings</th>
                    <th style={thStyle}>Bookings</th>
                    <th style={thStyle}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{u.full_name || '—'}</td>
                      <td style={tdStyle}>{u.email}</td>
                      <td style={tdStyle}>
                        {u.is_host
                          ? badge('Host', BURGUNDY, '#fff')
                          : badge('Guest', TAN, MUTED)}
                      </td>
                      <td style={tdStyle}>
                        <div
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                          }}
                        >
                          {u.email_verified
                            ? badge('Verified', '#E2F0E9', GREEN)
                            : badge('Unverified', '#FBF1DD', '#8A6D1F')}
                          {!u.email_verified ? (
                            <button
                              style={approveBtn}
                              disabled={busyId === u.id}
                              onClick={() => activateUser(u)}
                            >
                              {busyId === u.id ? 'Working…' : 'Activate'}
                            </button>
                          ) : null}
                          <button
                            style={dangerBtn}
                            disabled={busyId === u.id}
                            onClick={() => deleteUser(u)}
                          >
                            {busyId === u.id ? 'Working…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                      <td style={tdStyle}>{verificationBadge(u.verification_status)}</td>
                      <td style={tdStyle}>{u.listing_count}</td>
                      <td style={tdStyle}>{u.booking_count}</td>
                      <td style={{ ...tdStyle, color: MUTED, whiteSpace: 'nowrap' }}>
                        {fmtDay(u.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {/* ===================== LISTINGS ===================== */}
        {tab === 'listings' && loaded.listings ? (
          listings.length === 0 ? (
            <p style={{ color: MUTED, fontSize: 14 }}>No listings.</p>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {listings.map((l) => (
                <div
                  key={l.id}
                  style={{
                    ...cardStyle,
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                  }}
                >
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.image}
                      alt={l.title}
                      style={{
                        width: 120,
                        height: 90,
                        objectFit: 'cover',
                        borderRadius: 12,
                        border: `1px solid ${TAN}`,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 120,
                        height: 90,
                        borderRadius: 12,
                        background: TAN,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: MUTED,
                        fontSize: 11,
                      }}
                    >
                      No image
                    </div>
                  )}
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{l.title}</span>
                      {l.is_published
                        ? badge('Published', '#E2F0E9', GREEN)
                        : badge('Hidden', TAN, MUTED)}
                    </div>
                    <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                      {l.host_name ? `Host: ${l.host_name}` : 'Host: —'}
                      {l.location ? ` · ${l.location}` : ''}
                    </div>
                    <div style={{ fontSize: 14, marginTop: 6, color: INK }}>
                      {fmtMoney(l.price_per_night, l.currency)}{' '}
                      <span style={{ color: MUTED, fontSize: 12 }}>/ night</span>
                      <span style={{ color: MUTED, fontSize: 12 }}>
                        {' '}
                        · {l.booking_count} booking{l.booking_count === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      flexShrink: 0,
                      alignItems: 'center',
                    }}
                  >
                    <button
                      style={outlineBtn}
                      disabled={busyId === l.id}
                      onClick={() => togglePublish(l)}
                    >
                      {busyId === l.id ? 'Working…' : l.is_published ? 'Hide' : 'Show'}
                    </button>
                    <button
                      style={dangerBtn}
                      disabled={busyId === l.id}
                      onClick={() => deleteListing(l)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}

        {/* ===================== BOOKINGS ===================== */}
        {tab === 'bookings' && loaded.bookings ? (
          bookings.length === 0 ? (
            <p style={{ color: MUTED, fontSize: 14 }}>No bookings.</p>
          ) : (
            <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Guest</th>
                    <th style={thStyle}>Listing</th>
                    <th style={thStyle}>Dates</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Payment</th>
                    <th style={thStyle}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {b.reservation_code}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{b.guest_name || '—'}</div>
                        {b.guest_email ? (
                          <div style={{ color: MUTED, fontSize: 12 }}>{b.guest_email}</div>
                        ) : null}
                      </td>
                      <td style={tdStyle}>{b.listing_title || '—'}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: MUTED }}>
                        {fmtDay(b.check_in)} → {fmtDay(b.check_out)}
                      </td>
                      <td style={tdStyle}>{statusBadge(b.status)}</td>
                      <td style={tdStyle}>
                        {(b.payment_status || '').toLowerCase() === 'paid'
                          ? badge('Paid', '#E2F0E9', GREEN)
                          : badge('Unpaid', TAN, MUTED)}
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {fmtMoney(b.total_price, b.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {/* ===================== HOST APPLICATIONS ===================== */}
        {tab === 'applications' && loaded.applications ? (
          apps.length === 0 ? (
            <p style={{ color: MUTED, fontSize: 14 }}>No pending applications.</p>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {apps.map((a) => (
                <div key={a.id} style={cardStyle}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>
                      {a.full_name || a.email || 'Applicant'}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED }}>{fmtDate(a.submitted_at)}</div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '10px 18px',
                      margin: '14px 0',
                    }}
                  >
                    {a.email ? (
                      <div>
                        <div style={labelStyle}>Email</div>
                        <div style={{ fontSize: 14 }}>{a.email}</div>
                      </div>
                    ) : null}
                    {a.national_id ? (
                      <div>
                        <div style={labelStyle}>National ID</div>
                        <div style={{ fontSize: 14 }}>{a.national_id}</div>
                      </div>
                    ) : null}
                    {a.phone ? (
                      <div>
                        <div style={labelStyle}>Phone</div>
                        <div style={{ fontSize: 14 }}>{a.phone}</div>
                      </div>
                    ) : null}
                    {a.company ? (
                      <div>
                        <div style={labelStyle}>Company</div>
                        <div style={{ fontSize: 14 }}>{a.company}</div>
                      </div>
                    ) : null}
                    {a.address ? (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Address</div>
                        <div style={{ fontSize: 14 }}>{a.address}</div>
                      </div>
                    ) : null}
                    {a.notes ? (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Notes</div>
                        <div style={{ fontSize: 14 }}>{a.notes}</div>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      style={approveBtn}
                      disabled={busyId === a.id}
                      onClick={() => decideApp(a.id, 'approve')}
                    >
                      {busyId === a.id ? 'Working…' : 'Approve'}
                    </button>
                    <button
                      style={outlineBtn}
                      disabled={busyId === a.id}
                      onClick={() => decideApp(a.id, 'reject')}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}

        {/* ===================== ID VERIFICATIONS ===================== */}
        {tab === 'verifications' && loaded.verifications ? (
          verifs.length === 0 ? (
            <p style={{ color: MUTED, fontSize: 14 }}>No pending verifications.</p>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {verifs.map((v) => (
                <div key={v.id} style={cardStyle}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>
                      {v.full_name || v.email || 'Applicant'}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED }}>{fmtDate(v.submitted_at)}</div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '10px 18px',
                      margin: '14px 0',
                    }}
                  >
                    {v.email ? (
                      <div>
                        <div style={labelStyle}>Email</div>
                        <div style={{ fontSize: 14 }}>{v.email}</div>
                      </div>
                    ) : null}
                    {v.id_number ? (
                      <div>
                        <div style={labelStyle}>ID number</div>
                        <div style={{ fontSize: 14 }}>{v.id_number}</div>
                      </div>
                    ) : null}
                  </div>
                  {v.image_data ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.image_data}
                      alt="Submitted ID"
                      style={{
                        maxHeight: 160,
                        maxWidth: '100%',
                        borderRadius: 12,
                        border: `1px solid ${TAN}`,
                        display: 'block',
                        marginBottom: 14,
                      }}
                    />
                  ) : null}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      style={approveBtn}
                      disabled={busyId === v.id}
                      onClick={() => decideVerif(v.id, 'verify')}
                    >
                      {busyId === v.id ? 'Working…' : 'Verify'}
                    </button>
                    <button
                      style={outlineBtn}
                      disabled={busyId === v.id}
                      onClick={() => decideVerif(v.id, 'reject')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    </main>
  )
}
