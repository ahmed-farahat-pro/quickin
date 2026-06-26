'use client'

// QuickIn — operations console (local-stack admin).
// Self-contained client page: operator types an admin key (stored in
// localStorage 'qk_ops_key', never hardcoded), then reviews live host
// applications and ID verifications against the real (Neon) data.
import { useCallback, useEffect, useState } from 'react'

// Boutique palette.
const BURGUNDY = '#5B0F16'
const CREAM = '#F6F1E6'
const TAN = '#EFE6D8'
const INK = '#2A2220'
const MUTED = '#6B6055'
const GREEN = '#2E7D5B'
const KEY_STORAGE = 'qk_ops_key'

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

export default function OpsPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [ready, setReady] = useState(false)

  const [apps, setApps] = useState<HostApplication[]>([])
  const [verifs, setVerifs] = useState<Verification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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

  const loadData = useCallback(async (key: string) => {
    setLoading(true)
    setError(null)
    try {
      const opts: RequestInit = { headers: { 'x-admin-key': key }, cache: 'no-store' }
      const [appsRes, verifRes] = await Promise.all([
        fetch(`/api/local/admin/host-applications?key=${encodeURIComponent(key)}`, opts),
        fetch(`/api/local/admin/verifications?key=${encodeURIComponent(key)}`, opts),
      ])

      if (appsRes.status === 403 || verifRes.status === 403) {
        // Wrong key — drop it and re-prompt.
        try {
          localStorage.removeItem(KEY_STORAGE)
        } catch {
          /* ignore */
        }
        setAdminKey(null)
        setApps([])
        setVerifs([])
        setError('Wrong key — please try again.')
        return
      }

      if (!appsRes.ok || !verifRes.ok) {
        setError('Could not load live data. Please retry.')
        return
      }

      const appsJson = (await appsRes.json()) as { applications?: HostApplication[] }
      const verifJson = (await verifRes.json()) as { verifications?: Verification[] }
      setApps(Array.isArray(appsJson.applications) ? appsJson.applications : [])
      setVerifs(Array.isArray(verifJson.verifications) ? verifJson.verifications : [])
    } catch {
      setError('Network error. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Whenever we hold a key, (re)load the queues.
  useEffect(() => {
    if (adminKey) void loadData(adminKey)
  }, [adminKey, loadData])

  const unlock = (e: React.FormEvent) => {
    e.preventDefault()
    const key = keyInput.trim()
    if (!key) return
    try {
      localStorage.setItem(KEY_STORAGE, key)
    } catch {
      /* ignore */
    }
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
    setApps([])
    setVerifs([])
    setError(null)
  }

  const post = async (
    endpoint: 'host-applications' | 'verifications',
    body: Record<string, unknown>,
  ): Promise<boolean> => {
    if (!adminKey) return false
    try {
      const res = await fetch(`/api/local/admin/${endpoint}?key=${encodeURIComponent(adminKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(body),
      })
      if (res.status === 403) {
        try {
          localStorage.removeItem(KEY_STORAGE)
        } catch {
          /* ignore */
        }
        setAdminKey(null)
        setError('Wrong key — please try again.')
        return false
      }
      return res.ok
    } catch {
      setError('Network error. Please retry.')
      return false
    }
  }

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
  const labelStyle: React.CSSProperties = { fontSize: 12, color: MUTED, marginBottom: 2 }

  // Avoid SSR/client mismatch while reading localStorage.
  if (!ready) {
    return (
      <main style={pageStyle}>
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '48px 20px', color: MUTED }}>Loading…</div>
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
            <h1 style={{ color: BURGUNDY, fontSize: 22, fontWeight: 700, margin: 0 }}>QuickIn — operations</h1>
            <p style={{ color: MUTED, fontSize: 13, margin: '8px 0 18px' }}>
              Enter the admin key to review live applications.
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
            {error ? (
              <p style={{ color: BURGUNDY, fontSize: 13, margin: '0 0 12px' }}>{error}</p>
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

  // ---- unlocked: console ----
  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '36px 20px 64px' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 8,
          }}
        >
          <div>
            <h1 style={{ color: BURGUNDY, fontSize: 26, fontWeight: 700, margin: 0 }}>
              QuickIn — operations
            </h1>
            <p style={{ color: MUTED, fontSize: 13, margin: '4px 0 0' }}>
              This console reads and writes <strong>live data</strong>. Actions take effect immediately.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => adminKey && loadData(adminKey)} style={outlineBtn} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button onClick={lock} style={outlineBtn}>
              Lock
            </button>
          </div>
        </header>

        {error ? (
          <p
            style={{
              color: BURGUNDY,
              background: TAN,
              border: `1px solid ${BURGUNDY}`,
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 13,
              marginTop: 16,
            }}
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <p style={{ color: MUTED, fontSize: 14, marginTop: 24 }}>Loading live data…</p>
        ) : (
          <>
            {/* Host applications */}
            <section style={{ marginTop: 28 }}>
              <h2 style={{ color: BURGUNDY, fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>
                Host applications ({apps.length})
              </h2>
              {apps.length === 0 ? (
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
              )}
            </section>

            {/* ID verifications */}
            <section style={{ marginTop: 36 }}>
              <h2 style={{ color: BURGUNDY, fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>
                ID verifications ({verifs.length})
              </h2>
              {verifs.length === 0 ? (
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
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
