'use client'

// Site-wide "Get the app" bar pinned to the TOP of every page, above the header.
// Reads the admin-set store links from /api/local/app-links (managed in /ops as
// app_ios_url / app_android_url) and renders both store badges with their real
// marks. Unlike the old phone-only bottom bar this shows on every breakpoint and
// always offers both stores, so a desktop visitor can still find the apps.
// Dismissible; the choice is remembered locally.
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

const COLORS = { burgundy: '#5B0F16', cream: '#F6F1E6', tan: '#EFE6D8' }
const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'
const DISMISS_KEY = 'qk_app_bar_dismissed'

interface AppLinks {
  ios: string | null
  android: string | null
}

/** Apple's mark, used to label the App Store link. */
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

/** Google Play's four-colour mark. Keeps its own colours (not currentColor). */
function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 512 512" width="15" height="15" aria-hidden="true" focusable="false">
      <path fill="#00D0FF" d="M47.6 24.5C41.6 30.8 38 40.6 38 53.3v405.4c0 12.7 3.6 22.5 9.6 28.8l1.4 1.3 227.2-227.2v-5.4L48.9 23.2l-1.3 1.3z" />
      <path fill="#FFD500" d="M352 333.6l-75.8-75.9v-5.4l75.9-75.9 1.7 1 89.8 51c25.6 14.6 25.6 38.4 0 53l-89.8 51-1.8 1.2z" />
      <path fill="#FF3A44" d="M353.7 332.4L276 254.7 47.6 483.1c8.4 8.9 22.3 10 38 1.1l268.1-151.8z" />
      <path fill="#00E77B" d="M353.7 177.1L85.6 25.4c-15.7-8.9-29.6-7.8-38 1.1l228.4 228.2 77.7-77.6z" />
    </svg>
  )
}

export default function AppStoreBar() {
  const t = useTranslations('appBanner')
  const [show, setShow] = useState(false)
  const [links, setLinks] = useState<AppLinks | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      /* localStorage may be unavailable */
    }
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

  const badge = (href: string, icon: React.ReactNode, label: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={badgeStyle}>
      {icon}
      <span>{label}</span>
    </a>
  )

  return (
    <div style={barStyle} role="region" aria-label={t('title')}>
      <div style={copyStyle}>
        <strong style={{ fontWeight: 700 }}>{t('title')}</strong>
        <span style={subtitleStyle}>{t('subtitle')}</span>
      </div>
      <div style={{ display: 'inline-flex', gap: 8, flex: '0 0 auto' }}>
        {ios ? badge(ios, <AppleIcon />, t('appStore')) : null}
        {android ? badge(android, <GooglePlayIcon />, t('googlePlay')) : null}
      </div>
      <button type="button" onClick={dismiss} aria-label={t('dismiss')} style={closeStyle}>
        ×
      </button>
    </div>
  )
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: COLORS.burgundy,
  color: COLORS.cream,
  padding: '8px 14px',
  fontFamily: FONT,
  fontSize: 13.5,
  // The bar participates in normal flow at the very top of <body>, so it sits
  // above the site header without overlapping any sticky nav below it.
  width: '100%',
}
const copyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  minWidth: 0,
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
const subtitleStyle: React.CSSProperties = {
  color: COLORS.tan,
  fontSize: 12.5,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: COLORS.cream,
  color: COLORS.burgundy,
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: 12.5,
  padding: '6px 12px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  lineHeight: 1,
}
const closeStyle: React.CSSProperties = {
  flex: '0 0 auto',
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  color: COLORS.tan,
  fontSize: 20,
  lineHeight: 1,
  cursor: 'pointer',
  padding: '0 2px',
}
