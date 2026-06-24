// Host dashboard (no Supabase) — the signed-in host's listings + incoming
// reservations. Server-side auth reads the qk_token cookie (same pattern as
// /explore and /reservations); the interactive Approve/Decline panel lives in
// the 'use client' component below.
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getHostListings, type Listing } from '@/lib/local/db'
import { verifyToken, getUserRowByEmail } from '@/lib/local/auth'
import { HostReservations } from './host-reservations'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Host dashboard — QuickIn',
  description: 'Manage your QuickIn listings and respond to reservation requests.',
  alternates: { canonical: '/host' },
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

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80'

async function getCurrentUser(): Promise<{ id: string; firstName: string } | null> {
  const token = (await cookies()).get('qk_token')?.value
  if (!token) return null
  const claims = verifyToken(token)
  if (!claims?.email) return null
  try {
    const row = await getUserRowByEmail(claims.email)
    if (!row) return null
    const name = row.full_name?.trim() || row.email.split('@')[0]
    return { id: row.id, firstName: name.split(' ')[0] }
  } catch {
    return null
  }
}

function Header() {
  return (
    <header
      style={{
        background: `linear-gradient(180deg, ${COLORS.tan} 0%, ${COLORS.cream} 100%)`,
        borderBottom: `1px solid rgba(91,15,22,0.10)`,
        padding: '20px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 1040,
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
          href="/explore"
          style={{
            color: COLORS.burgundy,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ← Back to explore
        </a>
      </div>
    </header>
  )
}

export default async function HostPage() {
  const user = await getCurrentUser()

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: FONT,
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .qk-host-grid { grid-template-columns: 1fr !important; }
          .qk-host-listing-card { grid-template-columns: 1fr !important; }
          .qk-host-listing-card .qk-host-listing-img {
            width: 100% !important; height: 170px !important;
          }
        }
      `}</style>

      <Header />

      <section
        style={{
          maxWidth: 1040,
          margin: '0 auto',
          padding: '36px 24px 72px',
        }}
      >
        {!user ? (
          <BecomeAHost />
        ) : (
          <HostDashboard userId={user.id} firstName={user.firstName} />
        )}
      </section>
    </main>
  )
}

/** Signed-out intro: short pitch + login CTA. */
function BecomeAHost() {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 28,
        border: `1px solid rgba(42,34,32,0.06)`,
        boxShadow: '0 8px 30px rgba(42,34,32,0.07)',
        padding: '56px 32px',
        textAlign: 'center',
        maxWidth: 620,
        margin: '24px auto 0',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: COLORS.muted,
        }}
      >
        Become a host
      </p>
      <h1
        style={{
          margin: '10px 0 0',
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 'clamp(28px, 5vw, 40px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: COLORS.burgundy,
          lineHeight: 1.1,
        }}
      >
        Share your space, host on QuickIn
      </h1>
      <p
        style={{
          margin: '16px auto 0',
          fontSize: 16,
          lineHeight: 1.6,
          color: COLORS.muted,
          maxWidth: 480,
        }}
      >
        List your home in minutes, set your own nightly rate, and approve every
        guest yourself. You stay in control of who stays, when, and at what price.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 14,
          margin: '28px 0 0',
        }}
      >
        {[
          { t: 'You set the price', d: 'Per night, in your currency.' },
          { t: 'You approve guests', d: 'Every request needs your yes.' },
          { t: 'No upfront cost', d: 'List for free, today.' },
        ].map((f) => (
          <div
            key={f.t}
            style={{
              flex: '1 1 150px',
              minWidth: 150,
              background: COLORS.cream,
              borderRadius: 18,
              padding: '16px 14px',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14.5, color: COLORS.ink }}>{f.t}</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>{f.d}</div>
          </div>
        ))}
      </div>

      <a
        href="/login"
        style={{
          display: 'inline-block',
          marginTop: 32,
          color: '#fff',
          background: COLORS.burgundy,
          textDecoration: 'none',
          fontWeight: 700,
          padding: '13px 30px',
          borderRadius: 999,
          fontSize: 15,
        }}
      >
        Log in to start hosting
      </a>
    </div>
  )
}

/** Signed-in dashboard: listings grid + a "Create a listing" CTA + incoming reservations. */
async function HostDashboard({ userId, firstName }: { userId: string; firstName: string }) {
  const listings = await getHostListings(userId)

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
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
            Hosting, {firstName}
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: COLORS.muted }}>
            {listings.length === 0
              ? 'You have no listings yet.'
              : `${listings.length} ${listings.length === 1 ? 'listing' : 'listings'} published.`}
          </p>
        </div>
        <a
          href="/host/new"
          style={{
            color: '#fff',
            background: COLORS.burgundy,
            textDecoration: 'none',
            fontWeight: 700,
            padding: '12px 24px',
            borderRadius: 999,
            fontSize: 14.5,
            whiteSpace: 'nowrap',
          }}
        >
          + Create a listing
        </a>
      </div>

      {/* Listings */}
      {listings.length === 0 ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 22,
            border: `1px solid rgba(42,34,32,0.06)`,
            boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
            padding: '44px 24px',
            textAlign: 'center',
            color: COLORS.muted,
            marginBottom: 40,
          }}
        >
          <p style={{ margin: '0 0 18px', fontSize: 15 }}>
            List your first space to start welcoming guests.
          </p>
          <a
            href="/host/new"
            style={{
              display: 'inline-block',
              color: '#fff',
              background: COLORS.burgundy,
              textDecoration: 'none',
              fontWeight: 700,
              padding: '11px 24px',
              borderRadius: 999,
            }}
          >
            Create a listing
          </a>
        </div>
      ) : (
        <div
          className="qk-host-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 18,
            marginBottom: 44,
          }}
        >
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}

      {/* Incoming reservations (client component fetches /api/local/host/bookings) */}
      <h2
        style={{
          margin: '0 0 16px',
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 'clamp(22px, 3.4vw, 28px)',
          fontWeight: 700,
          color: COLORS.burgundy,
        }}
      >
        Incoming reservations
      </h2>
      <HostReservations />
    </>
  )
}

function ListingCard({ listing }: { listing: Listing }) {
  const img =
    listing.image_url ||
    listing.listing_images?.[0]?.url ||
    FALLBACK_IMG
  const price = listing.price_per_night
  const cur = listing.currency || 'USD'
  const priceLabel = cur && cur !== 'USD' ? `${price} ${cur}` : `$${price}`

  return (
    <article
      className="qk-host-listing-card"
      style={{
        background: '#fff',
        borderRadius: 20,
        border: `1px solid rgba(42,34,32,0.06)`,
        boxShadow: '0 6px 24px rgba(42,34,32,0.07)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr',
      }}
    >
      <div className="qk-host-listing-img" style={{ width: '100%', height: 160, background: COLORS.tan }}>
        <img
          src={img}
          alt={listing.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.ink }}>
          {listing.title}
        </h3>
        {listing.location && (
          <p style={{ margin: '3px 0 0', fontSize: 13.5, color: COLORS.muted }}>
            {listing.location}
          </p>
        )}
        <p style={{ margin: '10px 0 0', fontSize: 14.5, color: COLORS.burgundy, fontWeight: 700 }}>
          {priceLabel}
          <span style={{ color: COLORS.muted, fontWeight: 500 }}> / night</span>
        </p>
      </div>
    </article>
  )
}
