'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT =
  '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

// Minimal typing for the Google Identity Services global.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (resp: { credential?: string }) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void
          prompt: () => void
        }
      }
    }
  }
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

function AppleGlyph() {
  return (
    <svg width="17" height="20" viewBox="0 0 17 20" fill="#fff" aria-hidden="true">
      <path d="M14.06 10.62c-.02-2.16 1.76-3.2 1.84-3.25-1-1.47-2.57-1.67-3.12-1.69-1.33-.13-2.59.78-3.26.78-.67 0-1.71-.76-2.81-.74-1.45.02-2.78.84-3.53 2.14-1.5 2.6-.38 6.45 1.08 8.56.71 1.03 1.56 2.19 2.67 2.15 1.07-.04 1.48-.69 2.78-.69 1.3 0 1.66.69 2.79.67 1.15-.02 1.88-1.05 2.59-2.09.81-1.2 1.15-2.36 1.16-2.42-.03-.01-2.23-.86-2.26-3.4zM11.9 4.3c.59-.72.99-1.71.88-2.71-.85.03-1.89.57-2.5 1.28-.55.63-1.03 1.65-.9 2.62.95.07 1.92-.48 2.52-1.19z" />
    </svg>
  )
}

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [gisReady, setGisReady] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement | null>(null)

  const googleEnabled = Boolean(GOOGLE_CLIENT_ID)

  // Send a verified Google ID token to the real backend.
  async function onGoogleCredential(credential: string) {
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Google sign-in failed. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = '/explore'
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  // Initialize Google Identity Services once its script is ready and render the
  // official Google button into our placeholder div.
  const initGis = useCallback(() => {
    if (!googleEnabled) return
    if (!window.google?.accounts?.id) return
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => {
        if (resp?.credential) onGoogleCredential(resp.credential)
      },
    })
    if (googleBtnRef.current) {
      googleBtnRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signup_with',
        shape: 'pill',
        logo_alignment: 'center',
        width: 348,
      })
    }
    setGisReady(true)
    // onGoogleCredential is stable enough for our purposes here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleEnabled])

  // On client-side navigation the gsi script may already be loaded, in which
  // case Script's onReady won't fire again — initialize directly.
  useEffect(() => {
    if (googleEnabled && window.google?.accounts?.id) initGis()
  }, [googleEnabled, initGis])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Unable to create account. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = '/explore'
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  function handleGoogleClick() {
    if (!googleEnabled) return
    setError(null)
    setNotice(null)
    // The rendered GIS button handles the flow directly; this fallback prompts
    // One Tap in case the styled button is shown instead.
    window.google?.accounts?.id?.prompt()
  }

  function handleAppleClick() {
    setError(null)
    setNotice(
      'Apple sign-in requires HTTPS + an Apple Developer Services ID (see OAUTH-SETUP.md).'
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: FONT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}
    >
      {/* Load Google Identity Services. The script tag is always present; the
          GIS callbacks only run when NEXT_PUBLIC_GOOGLE_CLIENT_ID is set. */}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={initGis}
      />
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 28,
          boxShadow: '0 12px 48px rgba(42,34,32,0.12)',
          border: '1px solid rgba(42,34,32,0.06)',
          padding: '40px 36px 36px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/logo.png"
            alt="QuickIn"
            style={{ height: 54, width: 'auto', margin: '0 auto', display: 'block' }}
          />
          <p style={{ margin: '14px 0 0', fontSize: 15, color: COLORS.muted }}>
            Create your account to start exploring
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(91,15,22,0.06)',
              border: '1px solid rgba(91,15,22,0.18)',
              color: COLORS.burgundy,
              fontSize: 14,
              borderRadius: 14,
              padding: '10px 14px',
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            style={{
              background: 'rgba(42,34,32,0.05)',
              border: '1px solid rgba(42,34,32,0.14)',
              color: COLORS.ink,
              fontSize: 13.5,
              borderRadius: 14,
              padding: '10px 14px',
              marginBottom: 18,
            }}
          >
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.ink,
                marginBottom: 6,
              }}
            >
              Full name
            </span>
            <input
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Layla Hassan"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 16 }}>
            <span
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.ink,
                marginBottom: 6,
              }}
            >
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="layla@email.com"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 22 }}>
            <span
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.ink,
                marginBottom: 6,
              }}
            >
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              style={inputStyle}
            />
          </label>

          <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '24px 0',
          }}
        >
          <span style={{ flex: 1, height: 1, background: 'rgba(42,34,32,0.12)' }} />
          <span style={{ fontSize: 12, color: COLORS.muted }}>or</span>
          <span style={{ flex: 1, height: 1, background: 'rgba(42,34,32,0.12)' }} />
        </div>

        <button
          type="button"
          onClick={handleAppleClick}
          style={appleButtonStyle(false)}
        >
          <AppleGlyph />
          Continue with Apple
        </button>

        {/* Real Google sign-in. When configured, GIS renders its own button into
            this div; we also keep a styled fallback that triggers One Tap. */}
        {googleEnabled ? (
          <>
            <div
              ref={googleBtnRef}
              style={{
                display: 'flex',
                justifyContent: 'center',
                minHeight: 44,
              }}
            />
            {!gisReady && (
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={loading}
                style={googleButtonStyle(loading)}
              >
                <GoogleG />
                Continue with Google
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in"
              style={googleButtonStyle(true)}
            >
              <GoogleG />
              Continue with Google
            </button>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 12,
                color: COLORS.muted,
                textAlign: 'center',
              }}
            >
              Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in
            </p>
          </>
        )}

        <p style={{ margin: '26px 0 0', textAlign: 'center', fontSize: 14, color: COLORS.muted }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: COLORS.burgundy, fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </a>
        </p>
      </div>
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: FONT,
  fontSize: 15,
  color: COLORS.ink,
  background: COLORS.cream,
  border: '1px solid rgba(42,34,32,0.14)',
  borderRadius: 18,
  padding: '12px 16px',
  outline: 'none',
}

function primaryButtonStyle(loading: boolean): React.CSSProperties {
  return {
    width: '100%',
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    background: COLORS.burgundy,
    border: 'none',
    borderRadius: 20,
    padding: '13px 16px',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    transition: 'opacity 0.15s ease',
  }
}

function appleButtonStyle(loading: boolean): React.CSSProperties {
  return {
    width: '100%',
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: '#000',
    border: 'none',
    borderRadius: 20,
    padding: '12px 16px',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  }
}

function googleButtonStyle(loading: boolean): React.CSSProperties {
  return {
    width: '100%',
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: 600,
    color: '#3c4043',
    background: '#fff',
    border: '1px solid rgba(42,34,32,0.20)',
    borderRadius: 20,
    padding: '12px 16px',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  }
}
