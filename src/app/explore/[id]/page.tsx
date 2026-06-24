// Local listing detail (no Supabase, no auth) — boutique stay view.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getListingById, getListingReviews } from '@/lib/local/db'
import ReservePanel from './reserve-panel'
import WishlistButton from '../wishlist-button'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const t = await getTranslations('listingPage')
  const listing = await getListingById(id).catch(() => null)

  if (!listing) {
    return {
      title: t('meta.notFoundTitle'),
      description: t('meta.notFoundDescription'),
      robots: { index: false, follow: true },
    }
  }

  const place = [listing.location, listing.country].filter(Boolean).join(', ')
  const description =
    listing.description?.trim() ||
    (place
      ? t('meta.descriptionWithPlace', { place, price: listing.price_per_night })
      : t('meta.description', { price: listing.price_per_night }))
  const cover = listing.listing_images[0]?.url || '/logo.png'

  return {
    title: listing.title,
    description: description.slice(0, 160),
    alternates: { canonical: `/explore/${listing.id}` },
    openGraph: {
      title: `${listing.title} | QuickIn`,
      description: description.slice(0, 200),
      url: `/explore/${listing.id}`,
      type: 'website',
      siteName: 'QuickIn',
      images: [{ url: cover, alt: listing.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${listing.title} | QuickIn`,
      description: description.slice(0, 200),
      images: [cover],
    },
  }
}

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600&q=80'

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

function Spec({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 84,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color: COLORS.ink }}>
        {value}
      </span>
      <span style={{ fontSize: 13, color: COLORS.muted }}>{label}</span>
    </div>
  )
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('listingPage')
  const listing = await getListingById(id)
  if (!listing) notFound()

  // A reviews failure must never crash the stay page — fall back to none.
  const reviews = await getListingReviews(listing.id).catch(() => [])
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  const images = listing.listing_images
  const hero = images[0]?.url || FALLBACK_IMG
  const thumbs = images.slice(1)

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily:
          '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* On phones the details + reserve panel stack into one column and the
          sticky panel becomes static. Inline styles can't hold media queries. */}
      <style>{`
        @media (max-width: 760px) {
          .qk-detail-grid {
            grid-template-columns: 1fr !important;
          }
          .qk-detail-aside {
            position: static !important;
            top: auto !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 24px 72px' }}>
        {/* Back link */}
        <a
          href="/explore"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.burgundy,
            textDecoration: 'none',
            marginBottom: 22,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>&larr;</span>
          {t('backToExplore')}
        </a>

        {/* Hero */}
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: 24,
            overflow: 'hidden',
            background: COLORS.tan,
            boxShadow: '0 10px 36px rgba(42,34,32,0.12)',
          }}
        >
          <img
            src={hero}
            alt={listing.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* Thumbnail strip */}
        {thumbs.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              padding: '16px 2px 4px',
            }}
          >
            {thumbs.map((img, i) => (
              <img
                key={`${img.url}-${i}`}
                src={img.url}
                alt={t('photoAlt', { title: listing.title, index: i + 2 })}
                loading="lazy"
                style={{
                  width: 132,
                  height: 96,
                  flex: '0 0 auto',
                  objectFit: 'cover',
                  borderRadius: 14,
                  background: COLORS.tan,
                  boxShadow: '0 3px 12px rgba(42,34,32,0.10)',
                }}
              />
            ))}
          </div>
        )}

        {/* Title + location */}
        <div style={{ marginTop: 34 }}>
          {listing.is_guest_favorite && (
            <span
              style={{
                display: 'inline-block',
                background: COLORS.tan,
                color: COLORS.burgundy,
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: 999,
                marginBottom: 12,
              }}
            >
              ★ {t('guestFavorite')}
            </span>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily:
                  '"Playfair Display", Georgia, "Times New Roman", serif',
                fontSize: 'clamp(28px, 4.5vw, 42px)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                color: COLORS.burgundy,
              }}
            >
              {listing.title}
            </h1>
            <span style={{ flex: '0 0 auto', marginTop: 6 }}>
              <WishlistButton listingId={listing.id} />
            </span>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 16, color: COLORS.muted }}>
            {[listing.location, listing.country].filter(Boolean).join(', ')}
            {listing.property_type ? ` · ${listing.property_type}` : ''}
          </p>

          {/* Host card — shown when the listing resolves an owner. */}
          {listing.host_name && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 18,
                padding: '12px 16px',
                background: '#fff',
                border: '1px solid rgba(42,34,32,0.06)',
                borderRadius: 16,
                boxShadow: '0 4px 16px rgba(42,34,32,0.06)',
                width: 'fit-content',
              }}
            >
              {listing.host_avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.host_avatar}
                  alt={listing.host_name}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    objectFit: 'cover',
                    background: COLORS.tan,
                  }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    background: COLORS.tan,
                    color: COLORS.burgundy,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {listing.host_name.trim().charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>
                  Hosted by
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>
                  {listing.host_name}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Two-column: details + price card */}
        <div
          className="qk-detail-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)',
            gap: 36,
            marginTop: 30,
            alignItems: 'start',
          }}
        >
          <div>
            {/* Specs row */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 28,
                padding: '20px 0 24px',
                borderTop: `1px solid rgba(42,34,32,0.10)`,
                borderBottom: `1px solid rgba(42,34,32,0.10)`,
              }}
            >
              <Spec label={t('specs.guests')} value={listing.max_guests} />
              <Spec label={t('specs.bedrooms')} value={listing.bedrooms} />
              <Spec label={t('specs.beds')} value={listing.beds} />
              <Spec label={t('specs.baths')} value={listing.bathrooms} />
            </div>

            {/* Description */}
            {listing.description && (
              <div style={{ marginTop: 26 }}>
                <h2
                  style={{
                    margin: '0 0 10px',
                    fontSize: 19,
                    fontWeight: 700,
                    color: COLORS.ink,
                  }}
                >
                  {t('aboutThisStay')}
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 16,
                    lineHeight: 1.7,
                    color: COLORS.ink,
                  }}
                >
                  {listing.description}
                </p>
              </div>
            )}

            {/* Guest reviews */}
            <div style={{ marginTop: 26 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 19, fontWeight: 700, color: COLORS.ink }}>
                {avgRating ? `★ ${avgRating} · ` : ''}
                {reviews.length ? t('reviewsWithCount', { count: reviews.length }) : t('reviews')}
              </h2>
              {reviews.length === 0 ? (
                <p style={{ margin: 0, fontSize: 15, color: COLORS.muted }}>
                  {t('noReviews')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {reviews.map((r, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid rgba(42,34,32,0.06)', borderRadius: 14, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: 14.5, color: COLORS.ink }}>{r.reviewer_name || t('guest')}</strong>
                        <span style={{ fontSize: 13 }}>
                          <span style={{ color: '#f5a623' }}>{'★'.repeat(r.rating)}</span>
                          <span style={{ color: '#d8d2c8' }}>{'★'.repeat(5 - r.rating)}</span>
                        </span>
                        {r.created_at && <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 'auto' }}>{r.created_at}</span>}
                      </div>
                      {r.comment && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: COLORS.ink }}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reserve panel */}
          <aside
            className="qk-detail-aside"
            style={{
              background: '#fff',
              borderRadius: 22,
              border: `1px solid rgba(42,34,32,0.06)`,
              boxShadow: '0 8px 28px rgba(42,34,32,0.10)',
              padding: '24px 24px 26px',
              position: 'sticky',
              top: 24,
            }}
          >
            <ReservePanel
              listingId={listing.id}
              pricePerNight={listing.price_per_night}
              currency={listing.currency}
              maxGuests={listing.max_guests}
            />
            {listing.listing_code && (
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 18,
                  borderTop: `1px solid rgba(42,34,32,0.10)`,
                  fontSize: 13,
                  color: COLORS.muted,
                }}
              >
                {t('listingCode')}{' '}
                <span
                  style={{
                    fontFamily:
                      '"Geist Mono", ui-monospace, SFMono-Regular, monospace',
                    fontWeight: 600,
                    color: COLORS.ink,
                  }}
                >
                  {listing.listing_code}
                </span>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
