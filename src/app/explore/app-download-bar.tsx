'use client'

// Phone-only "download the app" bar. Reads the admin-set store links from
// /api/local/app-links, detects the visitor's platform, and shows the matching
// store button (or a "coming soon" note when that platform isn't live yet —
// e.g. iOS before launch). Dismissible; the choice is remembered locally.
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

const COLORS = { burgundy: '#5B0F16', ink: '#2A2220', muted: '#6B6055' }
const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'
const DISMISS_KEY = 'qk_app_bar_dismissed'

interface AppLinks {
  ios: string | null
  android: string | null
}

export default function AppDownloadBar() {
  const t = useTranslations('appBanner')
  const [show, setShow] = useState(false)
  const [links, setLinks] = useState<AppLinks | null>(null)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')

  useEffect(() => {
    // Phones only.
    if (!window.matchMedia('(max-width: 640px)').matches) return
    // Respect a previous dismissal.
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      /* localStorage may be unavailable */
    }
    const ua = navigator.userAgent || ''
    setPlatform(/iphone|ipad|ipod/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : 'other')
    setShow(true)
    fetch('/api/local/app-links', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: AppLinks | null) => {
        if (j) setLinks({ ios: j.ios ?? null, android: j.android ?? null })
      })
      .catch(() => {})
  }, [])

  if (!show || !links) return null
  const { ios, android } = links
  if (!ios && !android) return null // nothing configured yet

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setShow(false)
  }

  const storeBtn = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={ctaStyle}>
      {label}
    </a>
  )

  let cta: React.ReactNode
  if (platform === 'ios') {
    cta = ios ? storeBtn(ios, t('appStore')) : <span style={soonStyle}>{t('iosSoon')}</span>
  } else if (platform === 'android') {
    cta = android ? storeBtn(android, t('googlePlay')) : <span style={soonStyle}>{t('androidSoon')}</span>
  } else {
    cta = (
      <span style={{ display: 'inline-flex', gap: 8 }}>
        {android ? storeBtn(android, t('googlePlay')) : null}
        {ios ? storeBtn(ios, t('appStore')) : null}
      </span>
    )
  }

  return (
    <div style={barStyle} role="region" aria-label={t('title')}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.ink, lineHeight: 1.2 }}>{t('title')}</div>
        <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {t('subtitle')}
        </div>
      </div>
      {cta}
      <button type="button" onClick={dismiss} aria-label={t('dismiss')} style={closeStyle}>
        ×
      </button>
    </div>
  )
}

const barStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 950,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: '#fff',
  borderTop: '1px solid rgba(42,34,32,0.12)',
  boxShadow: '0 -6px 24px rgba(42,34,32,0.12)',
  padding: '11px 12px calc(11px + env(safe-area-inset-bottom))',
  fontFamily: FONT,
}
const ctaStyle: React.CSSProperties = {
  flex: '0 0 auto',
  background: COLORS.burgundy,
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: 13.5,
  padding: '10px 15px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
}
const soonStyle: React.CSSProperties = {
  flex: '0 0 auto',
  color: COLORS.muted,
  fontWeight: 600,
  fontSize: 12.5,
  whiteSpace: 'nowrap',
}
const closeStyle: React.CSSProperties = {
  flex: '0 0 auto',
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  color: COLORS.muted,
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
  padding: '0 2px',
}
