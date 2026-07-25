// Public host profile (local-stack, no Supabase) — boutique styling to match
// /explore and the listing detail. Shows the host's stays plus the reviews their
// guests left, so a browsing guest can judge a host by their whole portfolio.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getHostProfile, getUserById } from '@/lib/local/db'
import { formatPrice } from '@/lib/utils'

export const dynamic = 'force-dynamic'

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const t = await getTranslations('hostProfile')
  const user = await getUserById(id).catch(() => null)
  return {
    title: user?.full_name ? t('meta.title', { name: user.full_name }) : t('meta.fallback'),
    robots: { index: false, follow: true },
  }
}

function initial(name: string): string {
  return (name.trim()[0] || 'H').toUpperCase()
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span style={{ fontSize: 13, letterSpacing: 1 }}>
      <span style={{ color: '#f5a623' }}>{'★'.repeat(full)}</span>
      <span style={{ color: '#d8d2c8' }}>{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  )
}

export default async function HostProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('hostProfile')
  const data = await getHostProfile(id)
  if (!data) notFound()

  const { profile, listings, reviews, avgRating, totalReviews } = data
  const name = profile.full_name?.trim() || t('hostedBy')
  const memberYear = profile.created_at ? new Date(profile.created_at).getFullYear() : null

  return (
    <main style={{ minHeight: '100vh', background: COLORS.cream, color: COLORS.ink, fontFamily: FONT }}>
      <style>{`
        @media (max-width: 640px) { .qk-hp-grid { grid-template-columns: 1fr !important; } }
        .qk-hp-card { transition: transform .2s ease, box-shadow .2s ease; }
        .qk-hp-card:hover { transform: translateY(-4px); box-shadow: 0 16px 36px rgba(42,34,32,0.14); }
        .qk-hp-card:hover .qk-hp-img { transform: scale(1.05); }
        .qk-hp-img { transition: transform .5s cubic-bezier(.2,.7,.2,1); }
      `}</style>

      {/* Header */}
      <header
        style={{
          background: `linear-gradient(180deg, ${COLORS.tan} 0%, ${COLORS.cream} 100%)`,
          borderBottom: '1px solid rgba(91,15,22,0.10)',
          padding: '20px 24px',
        }}
      >
        <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <a href="/explore" style={{ display: 'inline-flex', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuickIn" height={40} style={{ height: 40, width: 'auto', display: 'block' }} />
          </a>
          <a href="/explore" style={{ color: COLORS.burgundy, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            ← {t('backToExplore')}
          </a>
        </div>
      </header>

      <section style={{ maxWidth: 1040, margin: '0 auto', padding: '36px 24px 72px' }}>
        {/* Host identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 999,
              background: COLORS.tan,
              color: COLORS.burgundy,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 30,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              initial(name)
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 'clamp(26px, 4vw, 36px)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: COLORS.burgundy,
                lineHeight: 1.1,
              }}
            >
              {name}
            </h1>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {profile.verification_status === 'verified' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: '#e7f5ec',
                    color: '#177245',
                    fontSize: 12.5,
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 999,
                  }}
                >
                  ✓ {t('verified')}
                </span>
              )}
              {memberYear && (
                <span style={{ fontSize: 14, color: COLORS.muted }}>{t('memberSince', { year: memberYear })}</span>
              )}
              {avgRating !== null && (
                <span style={{ fontSize: 14, color: COLORS.ink, fontWeight: 600 }}>
                  ★ {avgRating.toFixed(1)} <span style={{ color: COLORS.muted, fontWeight: 400 }}>· {t('reviews', { count: totalReviews })}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Listings */}
        {listings.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ margin: '0 0 18px', fontFamily: '"Playfair Display", Georgia, serif', fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, color: COLORS.burgundy }}>
              {t('stays', { count: listings.length })}
            </h2>
            <div className="qk-hp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 22 }}>
              {listings.map((l) => (
                <a
                  key={l.id}
                  href={`/explore/${l.id}`}
                  className="qk-hp-card"
                  style={{
                    display: 'block',
                    background: '#fff',
                    borderRadius: 20,
                    overflow: 'hidden',
                    textDecoration: 'none',
                    color: 'inherit',
                    border: '1px solid rgba(42,34,32,0.05)',
                    boxShadow: '0 6px 24px rgba(42,34,32,0.08)',
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', background: COLORS.tan }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.image_url || FALLBACK_IMG} alt={l.title} className="qk-hp-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '14px 16px 18px' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.ink, lineHeight: 1.3 }}>{l.title}</h3>
                    {l.location && (
                      <p style={{ margin: '4px 0 0', fontSize: 13.5, color: COLORS.muted }}>{l.location}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
                      <span style={{ fontSize: 15, color: COLORS.ink }}>
                        <span style={{ fontWeight: 700, color: COLORS.burgundy, fontSize: 16.5 }}>{formatPrice(l.price_per_night, l.currency)}</span>{' '}
                        <span style={{ color: COLORS.muted, fontSize: 13 }}>{t('perNight')}</span>
                      </span>
                      {l.rating != null && l.rating_count > 0 && (
                        <span style={{ fontSize: 13.5, color: COLORS.ink, fontWeight: 600, whiteSpace: 'nowrap' }}>★ {l.rating.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section style={{ marginTop: 44 }}>
            <h2 style={{ margin: '0 0 18px', fontFamily: '"Playfair Display", Georgia, serif', fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, color: COLORS.burgundy }}>
              {t('guestReviews')}
            </h2>
            <div className="qk-hp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ background: '#fff', border: '1px solid rgba(42,34,32,0.06)', borderRadius: 16, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        background: COLORS.tan,
                        color: COLORS.burgundy,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {r.reviewer_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.reviewer_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        initial(r.reviewer_name || t('guest'))
                      )}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{r.reviewer_name || t('guest')}</div>
                      <Stars rating={r.rating} />
                    </div>
                  </div>
                  {r.comment && <p style={{ margin: '0 0 6px', fontSize: 14.5, lineHeight: 1.6, color: COLORS.ink }}>{r.comment}</p>}
                  {r.listing_title && (
                    <p style={{ margin: 0, fontSize: 12.5, color: COLORS.muted }}>{t('reviewFor', { title: r.listing_title })}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {listings.length === 0 && reviews.length === 0 && (
          <p style={{ textAlign: 'center', color: COLORS.muted, padding: '56px 24px', fontSize: 15 }}>
            {t('noListings')}
          </p>
        )}
      </section>
    </main>
  )
}
