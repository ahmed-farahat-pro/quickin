// Local browse grid (no Supabase) — boutique stays explorer with search.
// The header/footer + server-side auth are rendered here; the interactive
// search/grid/map lives in the client component below.
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getListings } from '@/lib/local/db'
import { verifyToken, getUserRowByEmail } from '@/lib/local/auth'
import ExploreClient from './explore-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Explore boutique stays',
  description:
    'Browse a curated collection of hand-picked homes — from lakeside villas to desert hideaways. Search by location, dates, and guests.',
  alternates: { canonical: '/explore' },
  openGraph: {
    title: 'Explore boutique stays | QuickIn',
    description:
      'Browse a curated collection of hand-picked homes — from lakeside villas to desert hideaways.',
    url: '/explore',
    type: 'website',
    siteName: 'QuickIn',
    images: [{ url: '/logo.png', width: 700, height: 454, alt: 'QuickIn' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore boutique stays | QuickIn',
    description:
      'Browse a curated collection of hand-picked homes — from lakeside villas to desert hideaways.',
    images: ['/logo.png'],
  },
}

// Read the qk_token cookie and resolve the signed-in user's first name (or null).
async function getCurrentFirstName(): Promise<string | null> {
  const token = (await cookies()).get('qk_token')?.value
  if (!token) return null
  const claims = verifyToken(token)
  if (!claims?.email) return null
  try {
    const row = await getUserRowByEmail(claims.email)
    const name = row?.full_name?.trim() || claims.email.split('@')[0]
    return name ? name.split(' ')[0] : null
  } catch {
    return null
  }
}

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{
    location?: string
    checkIn?: string
    checkOut?: string
    guests?: string
  }>
}) {
  const sp = await searchParams
  const location = sp.location?.trim() || ''
  const checkIn = sp.checkIn?.trim() || ''
  const checkOut = sp.checkOut?.trim() || ''
  const guestsRaw = sp.guests?.trim() || ''
  const guests = guestsRaw ? Number(guestsRaw) : undefined

  const [listings, firstName] = await Promise.all([
    getListings({
      location: location || undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      guests: guests && Number.isFinite(guests) ? guests : undefined,
    }),
    getCurrentFirstName(),
  ])

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Footer grid collapses from 4 cols → 2 → 1 as the viewport narrows so
          it never overflows on phones. Inline styles can't hold media queries. */}
      <style>{`
        @media (max-width: 720px) {
          .qk-footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 440px) {
          .qk-footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Header bar */}
      <header
        style={{
          background: `linear-gradient(180deg, ${COLORS.tan} 0%, ${COLORS.cream} 100%)`,
          borderBottom: `1px solid rgba(91,15,22,0.10)`,
          padding: '20px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {/* Logo */}
          <a href="/explore" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <img
              src="/logo.png"
              alt="QuickIn"
              height={40}
              style={{ height: 40, width: 'auto', display: 'block' }}
            />
          </a>

          {/* Right side: become a host + auth */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              fontSize: 14,
            }}
          >
            <a
              href="/host"
              style={{
                color: COLORS.ink,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Become a host
            </a>
            {firstName ? (
              <>
                <span style={{ color: COLORS.ink, fontWeight: 600 }}>
                  Hi, {firstName}
                </span>
                <a
                  href="/api/auth/logout"
                  style={{
                    color: COLORS.muted,
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Logout
                </a>
              </>
            ) : (
              <>
                <a
                  href="/login"
                  style={{
                    color: COLORS.ink,
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Log in
                </a>
                <a
                  href="/signup"
                  style={{
                    color: '#fff',
                    background: COLORS.burgundy,
                    textDecoration: 'none',
                    fontWeight: 600,
                    padding: '9px 18px',
                    borderRadius: 999,
                  }}
                >
                  Sign up
                </a>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Live search + results grid + map view (client component).
          The server-fetched listings seed the first paint; the client then
          re-fetches /api/local/listings live as the user types/filters. */}
      <ExploreClient
        initialListings={listings}
        initialFilters={{ location, checkIn, checkOut, guests: guestsRaw }}
      />

      {/* Footer */}
      <footer
        style={{
          background: COLORS.burgundy,
          color: COLORS.cream,
          padding: '48px 24px 32px',
        }}
      >
        <div
          className="qk-footer-grid"
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(3, 1fr)',
            gap: 32,
          }}
        >
          <div>
            <img
              src="/logo.png"
              alt="QuickIn"
              height={36}
              style={{
                height: 36,
                width: 'auto',
                display: 'block',
                marginBottom: 14,
                filter: 'brightness(0) invert(1)',
              }}
            />
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                color: 'rgba(246,241,230,0.78)',
                maxWidth: 280,
              }}
            >
              QuickIn — boutique stays for travelers who love the details.
            </p>
          </div>

          <FooterColumn
            title="Support"
            links={['Help center', 'Cancellation options', 'Safety info']}
          />
          <FooterColumn
            title="Hosting"
            links={['Become a host', 'Host resources', 'Community forum']}
          />
          <FooterColumn
            title="About"
            links={['Our story', 'Careers', 'Press']}
          />
        </div>

        <div
          style={{
            maxWidth: 1200,
            margin: '32px auto 0',
            paddingTop: 22,
            borderTop: '1px solid rgba(246,241,230,0.18)',
            fontSize: 13,
            color: 'rgba(246,241,230,0.7)',
          }}
        >
          © 2026 QuickIn. Crafted for the curious traveler.
        </div>
      </footer>
    </main>
  )
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: 14,
          fontWeight: 700,
          color: COLORS.cream,
        }}
      >
        {title}
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {links.map((link) => (
          <li key={link} style={{ marginBottom: 8 }}>
            <a
              href="#"
              style={{
                fontSize: 14,
                color: 'rgba(246,241,230,0.78)',
                textDecoration: 'none',
              }}
            >
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
