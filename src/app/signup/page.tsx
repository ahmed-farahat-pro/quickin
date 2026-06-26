'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useTranslations } from 'next-intl'

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

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={COLORS.muted}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {off ? (
        <>
          <path d="M9.88 4.24A9.12 9.12 0 0 1 12 4c5.52 0 9.27 4.86 10 7 0 0-.5 1.46-1.74 2.92" />
          <path d="M6.07 6.06C3.4 7.6 2 10.86 2 11c.73 2.14 4.48 7 10 7a9.7 9.7 0 0 0 4-0.83" />
          <line x1="3" y1="3" x2="21" y2="21" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M2 11s3.75-7 10-7 10 7 10 7-3.75 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="11" r="3" />
        </>
      )}
    </svg>
  )
}

export default function SignupPage() {
  const t = useTranslations('signupLocal')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [gisReady, setGisReady] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement | null>(null)

  // OTP email-verification step (shown after a successful signup).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingEmail) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code: otpCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || t('errors.invalidCode'))
        setLoading(false)
        return
      }
      window.location.href = '/explore'
    } catch {
      setError(t('errors.network'))
      setLoading(false)
    }
  }

  async function resendOtp() {
    if (!pendingEmail || resendCooldown > 0) return
    setError(null)
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail }),
      })
      const data = await res.json().catch(() => ({}))
      setResendCooldown(Number(data?.cooldown) || 30)
      if (!res.ok) setError(data?.error || null)
      else setNotice(t('otp.newCodeSent'))
    } catch {
      setError(t('errors.network'))
    }
  }

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
        setError(data?.error || t('errors.googleFailed'))
        setLoading(false)
        return
      }
      window.location.href = '/explore'
    } catch {
      setError(t('errors.network'))
      setLoading(false)
    }
  }

  // Initialize Google Identity Services once its script is ready and render the
  // official Google button into our placeholder div.
  const initGis = useCallback(() => {
    if (!googleEnabled) return
    if (!(window as { google?: any }).google?.accounts?.id) return
    (window as { google?: any }).google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => {
        if (resp?.credential) onGoogleCredential(resp.credential)
      },
    })
    if (googleBtnRef.current) {
      googleBtnRef.current.innerHTML = ''
      ;(window as { google?: any }).google.accounts.id.renderButton(googleBtnRef.current, {
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
    if (googleEnabled && (window as { google?: any }).google?.accounts?.id) initGis()
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
        setError(data?.error || t('errors.createFailed'))
        setLoading(false)
        return
      }
      if (data?.pending) {
        // Email verification required — switch to the OTP step.
        setPendingEmail(data.email || email)
        setNotice(t('otp.codeSentTo', { email: data.email || email }))
        setResendCooldown(30)
        setLoading(false)
        return
      }
      window.location.href = '/explore'
    } catch {
      setError(t('errors.network'))
      setLoading(false)
    }
  }

  function handleGoogleClick() {
    if (!googleEnabled) return
    setError(null)
    setNotice(null)
    // The rendered GIS button handles the flow directly; this fallback prompts
    // One Tap in case the styled button is shown instead.
    ;(window as { google?: any }).google?.accounts?.id?.prompt()
  }

  function handleAppleClick() {
    setError(null)
    setNotice(t('apple.requiresHttps'))
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
            {t('subtitle')}
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

        {pendingEmail ? (
          <form onSubmit={verifyOtp}>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>
                {t('otp.label')}
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder={t('otp.placeholder')}
                style={{ ...inputStyle, letterSpacing: 6, textAlign: 'center', fontSize: 20 }}
              />
            </label>
            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              style={primaryButtonStyle(loading || otpCode.length < 6)}
            >
              {loading ? t('otp.verifying') : t('otp.verifyContinue')}
            </button>
            <p style={{ margin: '18px 0 0', textAlign: 'center', fontSize: 14, color: COLORS.muted }}>
              {t('otp.didntGet')}{' '}
              {resendCooldown > 0 ? (
                <span>{t('otp.resendIn', { seconds: resendCooldown })}</span>
              ) : (
                <button
                  type="button"
                  onClick={resendOtp}
                  style={{ background: 'none', border: 'none', color: COLORS.burgundy, fontWeight: 600, cursor: 'pointer', fontSize: 14, padding: 0 }}
                >
                  {t('otp.resendCode')}
                </button>
              )}
            </p>
          </form>
        ) : (
          <>
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
              {t('fields.fullName')}
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
              {t('fields.email')}
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
              {t('fields.password')}
            </span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('fields.passwordPlaceholder')}
                style={{ ...inputStyle, paddingInlineEnd: 46 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={eyeButtonStyle}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </label>

          <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
            {loading ? t('submit.creating') : t('submit.createAccount')}
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
          <span style={{ fontSize: 12, color: COLORS.muted }}>{t('divider.or')}</span>
          <span style={{ flex: 1, height: 1, background: 'rgba(42,34,32,0.12)' }} />
        </div>

        <button
          type="button"
          onClick={handleAppleClick}
          style={appleButtonStyle(false)}
        >
          <AppleGlyph />
          {t('apple.continue')}
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
                {t('google.continue')}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t('google.enableHint')}
              style={googleButtonStyle(true)}
            >
              <GoogleG />
              {t('google.continue')}
            </button>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 12,
                color: COLORS.muted,
                textAlign: 'center',
              }}
            >
              {t('google.enableHint')}
            </p>
          </>
        )}
          </>
        )}

        <p style={{ margin: '26px 0 0', textAlign: 'center', fontSize: 14, color: COLORS.muted }}>
          {t('signin.prompt')}{' '}
          <a href="/login" style={{ color: COLORS.burgundy, fontWeight: 600, textDecoration: 'none' }}>
            {t('signin.link')}
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

const eyeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  insetInlineEnd: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  padding: 0,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: COLORS.muted,
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
