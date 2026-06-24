// Create a new listing (no Supabase) — host-only. Server-side auth reads the
// qk_token cookie (same pattern as /explore) and redirects signed-out visitors
// to /login. The create form is the 'use client' component below.
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, getUserRowByEmail } from '@/lib/local/auth'
import { NewListingForm } from './new-listing-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Create a listing — QuickIn',
  description: 'List your space on QuickIn.',
  alternates: { canonical: '/host/new' },
  robots: { index: false, follow: true },
}

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

async function isSignedIn(): Promise<boolean> {
  const token = (await cookies()).get('qk_token')?.value
  if (!token) return false
  const claims = verifyToken(token)
  if (!claims?.email) return false
  try {
    const row = await getUserRowByEmail(claims.email)
    return !!row
  } catch {
    return false
  }
}

export default async function NewListingPage() {
  if (!(await isSignedIn())) redirect('/login')

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: FONT,
      }}
    >
      {/* Header */}
      <header
        style={{
          background: `linear-gradient(180deg, ${COLORS.tan} 0%, ${COLORS.cream} 100%)`,
          borderBottom: `1px solid rgba(91,15,22,0.10)`,
          padding: '20px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <a href="/explore" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <img
              src="/logo.png"
              alt="QuickIn"
              height={40}
              style={{ height: 40, width: 'auto', display: 'block' }}
            />
          </a>
          <a
            href="/host"
            style={{
              color: COLORS.burgundy,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            ← Back to hosting
          </a>
        </div>
      </header>

      <section style={{ maxWidth: 720, margin: '0 auto', padding: '36px 24px 72px' }}>
        <h1
          style={{
            margin: '0 0 6px',
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(26px, 4vw, 34px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: COLORS.burgundy,
          }}
        >
          Create a listing
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 15, color: COLORS.muted }}>
          Tell guests about your space. You can edit the details any time.
        </p>

        <NewListingForm />
      </section>
    </main>
  )
}
