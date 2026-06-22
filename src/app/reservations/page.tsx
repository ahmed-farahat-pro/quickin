// My reservations (no Supabase) — the signed-in user's bookings.
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { getUserBookings } from '@/lib/local/db'
import { verifyToken, getUserRowByEmail } from '@/lib/local/auth'
import { ReservationActions } from './reservation-actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reservationsLocal')
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/reservations' },
    robots: { index: false, follow: true },
    openGraph: {
      title: t('meta.ogTitle'),
      description: t('meta.ogDescription'),
      url: '/reservations',
      type: 'website',
      siteName: 'QuickIn',
      images: [{ url: '/logo.png', width: 700, height: 454, alt: 'QuickIn' }],
    },
  }
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

function fmtDate(d: string): string {
  // d is YYYY-MM-DD
  const date = new Date(d + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return d
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function Header({ backLabel }: { backLabel: string }) {
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
          maxWidth: 980,
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
          ← {backLabel}
        </a>
      </div>
    </header>
  )
}

export default async function ReservationsPage() {
  const user = await getCurrentUser()
  const t = await getTranslations('reservationsLocal')

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: FONT,
      }}
    >
      {/* On phones each reservation card stacks: full-width image on top, then
          details and price below. Inline styles can't carry media queries. */}
      <style>{`
        @media (max-width: 560px) {
          .qk-res-card {
            grid-template-columns: 1fr !important;
          }
          .qk-res-card .qk-res-img {
            width: 100% !important;
            height: 180px !important;
            min-height: 0 !important;
          }
          .qk-res-card .qk-res-body {
            padding: 16px 18px 0 !important;
          }
          .qk-res-card .qk-res-price {
            padding: 0 18px 18px !important;
            text-align: left !important;
            align-self: start !important;
          }
        }
      `}</style>

      <Header backLabel={t('backToExplore')} />

      <section
        style={{
          maxWidth: 980,
          margin: '0 auto',
          padding: '36px 24px 72px',
        }}
      >
        {!user ? (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 24px',
              color: COLORS.muted,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 30,
                fontWeight: 700,
                color: COLORS.burgundy,
              }}
            >
              {t('signedOut.title')}
            </h1>
            <p style={{ margin: '12px 0 22px', fontSize: 15 }}>
              {t('signedOut.subtitle')}
            </p>
            <a
              href="/login"
              style={{
                display: 'inline-block',
                color: '#fff',
                background: COLORS.burgundy,
                textDecoration: 'none',
                fontWeight: 700,
                padding: '12px 26px',
                borderRadius: 999,
              }}
            >
              {t('signedOut.logIn')}
            </a>
          </div>
        ) : (
          <ReservationsList userId={user.id} firstName={user.firstName} />
        )}
      </section>
    </main>
  )
}

async function ReservationsList({
  userId,
  firstName,
}: {
  userId: string
  firstName: string
}) {
  const bookings = await getUserBookings(userId)
  const t = await getTranslations('reservationsLocal')

  return (
    <>
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
        {t('listTitle', { name: firstName })}
      </h1>
      <p style={{ margin: '0 0 28px', fontSize: 15, color: COLORS.muted }}>
        {bookings.length === 0
          ? t('noneYet')
          : t('countBooked', { count: bookings.length })}
      </p>

      {bookings.length === 0 ? (
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
            {t('emptyState')}
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
            {t('browseStays')}
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {bookings.map((b) => (
            <article
              key={b.id}
              className="qk-res-card"
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr auto',
                gap: 20,
                background: '#fff',
                borderRadius: 20,
                border: `1px solid rgba(42,34,32,0.06)`,
                boxShadow: '0 6px 24px rgba(42,34,32,0.07)',
                overflow: 'hidden',
                alignItems: 'stretch',
              }}
            >
              <div
                className="qk-res-img"
                style={{
                  width: 160,
                  minHeight: 130,
                  background: COLORS.tan,
                }}
              >
                <img
                  src={b.image || FALLBACK_IMG}
                  alt={b.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>

              <div className="qk-res-body" style={{ padding: '18px 0', minWidth: 0 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: COLORS.ink,
                  }}
                >
                  {b.title}
                </h2>
                {b.location && (
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 14,
                      color: COLORS.muted,
                    }}
                  >
                    {b.location}
                  </p>
                )}
                <p
                  style={{
                    margin: '12px 0 0',
                    fontSize: 14,
                    color: COLORS.ink,
                  }}
                >
                  {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
                </p>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 14,
                    color: COLORS.muted,
                  }}
                >
                  {t('guestsCount', { count: b.guests })}
                </p>
                <ReservationActions
                  bookingId={b.id}
                  status={b.status}
                  paid={b.payment_status === 'paid'}
                  checkIn={b.check_in}
                  checkOut={b.check_out}
                />
              </div>

              <div
                className="qk-res-price"
                style={{
                  padding: '18px 22px',
                  textAlign: 'right',
                  alignSelf: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: COLORS.burgundy,
                  }}
                >
                  ${b.total_price}
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>{t('total')}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
