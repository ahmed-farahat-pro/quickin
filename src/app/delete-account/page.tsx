'use client'

import { useEffect, useState } from 'react'

// Public account-deletion page. Doubles as:
//  - the publicly-reachable deletion URL required by Google Play (linkable without the app), and
//  - an in-app deletion path (Apple 5.1.1(v) / Play) when the visitor is signed in.
const C = { burgundy: '#5B0F16', cream: '#F6F1E6', tan: '#EFE6D8', ink: '#2A2220', muted: '#6B6055' }
const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'
const SUPPORT_EMAIL = 'tech@problem-x.com'

export default function DeleteAccountPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEmail(d?.user?.email ?? null))
      .catch(() => setEmail(null))
      .finally(() => setLoaded(true))
  }, [])

  async function doDelete() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/local/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error || 'Could not delete your account. Please try again or email us.')
        setBusy(false)
        return
      }
      setDone(true)
    } catch {
      setError('Network error. Please try again or email us.')
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: C.cream, color: C.ink, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 24, border: '1px solid rgba(42,34,32,0.07)', boxShadow: '0 12px 40px rgba(42,34,32,0.10)', padding: '36px 32px' }}>
        <img src="/logo.png" alt="QuickIn" style={{ height: 44, display: 'block', margin: '0 auto 18px' }} />
        <h1 style={{ fontSize: 22, textAlign: 'center', margin: '0 0 6px' }}>Delete your QuickIn account</h1>
        <p style={{ fontSize: 14, color: C.muted, textAlign: 'center', margin: '0 0 22px' }}>
          This permanently removes your account and associated data.
        </p>

        <div style={{ background: C.cream, borderRadius: 16, padding: '14px 16px', marginBottom: 22, fontSize: 13.5, color: C.ink }}>
          <strong>What gets deleted:</strong>
          <ul style={{ margin: '8px 0 0', paddingInlineStart: 18, color: C.muted, lineHeight: 1.7 }}>
            <li>Your profile, email and login</li>
            <li>Your listings (if you host) and their photos</li>
            <li>Your bookings, reviews, wishlist and messages</li>
          </ul>
          <p style={{ margin: '10px 0 0', color: C.muted }}>This cannot be undone. Active/illegal-to-delete records may be retained only as required by law.</p>
        </div>

        {done ? (
          <div style={{ background: 'rgba(42,34,32,0.05)', border: '1px solid rgba(42,34,32,0.14)', borderRadius: 14, padding: '14px 16px', fontSize: 14, textAlign: 'center' }}>
            Your account has been deleted. We&apos;re sorry to see you go. <a href="/" style={{ color: C.burgundy, fontWeight: 600 }}>Return home</a>
          </div>
        ) : !loaded ? (
          <p style={{ textAlign: 'center', color: C.muted, fontSize: 14 }}>Loading…</p>
        ) : email ? (
          <>
            {error && <div style={{ background: 'rgba(91,15,22,0.06)', border: '1px solid rgba(91,15,22,0.18)', color: C.burgundy, fontSize: 13.5, borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>{error}</div>}
            <p style={{ fontSize: 14, margin: '0 0 12px' }}>Signed in as <strong>{email}</strong>.</p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: C.ink, marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ marginTop: 3 }} />
              <span>I understand this permanently deletes my account and data, and cannot be undone.</span>
            </label>
            <button
              onClick={doDelete}
              disabled={!confirm || busy}
              style={{ width: '100%', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: '#fff', background: '#b3261e', border: 'none', borderRadius: 16, padding: '13px 16px', cursor: !confirm || busy ? 'not-allowed' : 'pointer', opacity: !confirm || busy ? 0.6 : 1 }}
            >
              {busy ? 'Deleting…' : 'Permanently delete my account'}
            </button>
          </>
        ) : (
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 12px' }}>To delete your account, <a href="/login?redirect=/delete-account" style={{ color: C.burgundy, fontWeight: 600 }}>sign in</a> and return to this page — your account will be deleted in one tap.</p>
            <p style={{ margin: 0, color: C.muted }}>Can&apos;t sign in? Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete my QuickIn account`} style={{ color: C.burgundy, fontWeight: 600 }}>{SUPPORT_EMAIL}</a> from your account email and we&apos;ll delete it within 30 days.</p>
          </div>
        )}
      </div>
    </main>
  )
}
