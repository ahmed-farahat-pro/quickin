// =============================================================================
// GLOBAL ERROR BOUNDARY
// =============================================================================
// Friendly, brand-styled error screen shown when a route throws. Uses
// self-contained inline styles (boutique palette) so it renders even if
// Tailwind / i18n context is unavailable — important for launch resilience.
// =============================================================================

'use client'

import { useEffect } from 'react'

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])

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
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <img
          src="/logo.png"
          alt="QuickIn"
          style={{ height: 46, width: 'auto', margin: '0 auto 28px', display: 'block' }}
        />
        <h1
          style={{
            margin: 0,
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(24px, 5vw, 32px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: COLORS.burgundy,
          }}
        >
          Something went sideways
        </h1>
        <p style={{ margin: '12px 0 28px', fontSize: 15, lineHeight: 1.6, color: COLORS.muted }}>
          We hit an unexpected snag loading this page. Give it another try — most
          of the time that does the trick.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              fontFamily: FONT,
              fontSize: 15,
              fontWeight: 700,
              color: '#fff',
              background: COLORS.burgundy,
              border: 'none',
              borderRadius: 999,
              padding: '12px 28px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <a
            href="/explore"
            style={{
              fontFamily: FONT,
              fontSize: 15,
              fontWeight: 700,
              color: COLORS.ink,
              background: COLORS.tan,
              textDecoration: 'none',
              borderRadius: 999,
              padding: '12px 28px',
            }}
          >
            Back to Explore
          </a>
        </div>
      </div>
    </main>
  )
}
