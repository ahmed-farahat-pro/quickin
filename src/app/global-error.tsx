'use client'

// Self-contained global error boundary. It replaces the root layout entirely when
// a global error occurs, so it must NOT use next-intl / the locale provider — doing
// so makes next-intl's server config unresolvable during the production build.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body
        style={{
          fontFamily: '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif',
          background: '#F6F1E6',
          color: '#2A2220',
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#5B0F16', fontSize: 28, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#6B6055', fontSize: 15, margin: '0 0 24px' }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{ background: '#5B0F16', color: '#fff', border: 'none', borderRadius: 999, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
