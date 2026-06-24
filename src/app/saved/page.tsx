// Saved listings (no Supabase) — the signed-in user's wishlist.
// Server component: reads the qk_token cookie like explore/page.tsx, redirects
// to /login when signed out, then renders a boutique grid of saved stays each
// with a WishlistButton (so the user can un-save inline).
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getWishlistListings } from '@/lib/local/db'
import { verifyToken, getUserRowByEmail } from '@/lib/local/auth'
import { formatPrice } from '@/lib/utils'
import WishlistButton from '@/app/explore/wishlist-button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Saved · QuickIn',
  description: 'Your saved boutique stays on QuickIn.',
  alternates: { canonical: '/saved' },
  robots: { index: false, follow: true },
}

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80'

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

async function getCurrentUserId(): Promise<string | null> {
  const token = (await cookies()).get('qk_token')?.value
  if (!token) return null
  const claims = verifyToken(token)
  if (!claims?.email) return null
  try {
    const row = await getUserRowByEmail(claims.email)
    return row?.id ?? null
  } catch {
    return null
  }
}

function imageOf(listing: {
  image_url?: string | null
  listing_images?: { url: string }[]
}): string {
  if (listing.image_url) return listing.image_url
  const first = listing.listing_images?.[0]?.url
  return first || FALLBACK_IMG
}

export default async function SavedPage() {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')

  const listings = await getWishlistListings(userId)

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: FONT,
      }}
    >
      {/* The saved grid reflows from 3 → 2 → 1 columns as the viewport narrows.
          Inline styles can't carry media queries, so a small <style> block does. */}
      <style>{`
        .qk-saved-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
        }
        @media (max-width: 820px) {
          .qk-saved-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 520px) {
          .qk-saved-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

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
            maxWidth: 1100,
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
            ← Back to Explore
          </a>
        </div>
      </header>

      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '36px 24px 72px',
        }}
      >
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
          Saved stays
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 15, color: COLORS.muted }}>
          {listings.length === 0
            ? 'You haven’t saved any stays yet.'
            : `${listings.length} saved ${listings.length === 1 ? 'stay' : 'stays'}.`}
        </p>

        {listings.length === 0 ? (
          <div
            style={{
              background: '#fff',
              borderRadius: 22,
              border: `1px solid rgba(42,34,32,0.06)`,
              boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
              padding: '48px 24px',
              textAlign: 'center',
              color: COLORS.muted,
            }}
          >
            <p style={{ margin: '0 0 18px', fontSize: 15 }}>
              Tap the heart on any stay to save it for later.
            </p>
            <a
              href="/explore"
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
              Browse stays
            </a>
          </div>
        ) : (
          <div className="qk-saved-grid">
            {listings.map((listing) => (
              <a
                key={listing.id}
                href={`/explore/${listing.id}`}
                style={{
                  position: 'relative',
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: '#fff',
                  borderRadius: 20,
                  border: `1px solid rgba(42,34,32,0.06)`,
                  boxShadow: '0 6px 24px rgba(42,34,32,0.07)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '4 / 3',
                    background: COLORS.tan,
                  }}
                >
                  <img
                    src={imageOf(listing)}
                    alt={listing.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      zIndex: 2,
                    }}
                  >
                    <WishlistButton listingId={listing.id} initialSaved />
                  </div>
                </div>
                <div style={{ padding: '16px 18px 18px' }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 17,
                      fontWeight: 700,
                      color: COLORS.ink,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {listing.title}
                  </h2>
                  {listing.location && (
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: 14,
                        color: COLORS.muted,
                      }}
                    >
                      {listing.location}
                    </p>
                  )}
                  <p
                    style={{
                      margin: '12px 0 0',
                      fontSize: 15,
                      fontWeight: 700,
                      color: COLORS.burgundy,
                    }}
                  >
                    {formatPrice(listing.price_per_night, listing.currency)}
                    <span
                      style={{
                        fontWeight: 500,
                        color: COLORS.muted,
                        fontSize: 14,
                      }}
                    >
                      {' '}/ night
                    </span>
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
