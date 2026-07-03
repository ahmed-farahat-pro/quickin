// Local browse grid (no Supabase) — boutique stays explorer with search.
// The header/footer + server-side auth are rendered here; the interactive
// search/grid/map lives in the client component below.
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'
import { NotificationsBell } from './notifications-bell'
import { MobileMenu } from './mobile-menu'
import { getTranslations, getLocale } from 'next-intl/server'
import { getListings, getWishlistIds } from '@/lib/local/db'
import { verifyToken, getUserRowByEmail } from '@/lib/local/auth'
import ExploreClient from './explore-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('explorePage')
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/explore' },
    openGraph: {
      title: t('meta.ogTitle'),
      description: t('meta.ogDescription'),
      url: '/explore',
      type: 'website',
      siteName: 'QuickIn',
      images: [{ url: '/logo.png', width: 700, height: 454, alt: 'QuickIn' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta.ogTitle'),
      description: t('meta.ogDescription'),
      images: ['/logo.png'],
    },
  }
}

// Read the qk_token cookie and resolve the signed-in user's first name + saved
// listing ids (both null/empty when signed out). One DB round-trip for the user
// row, then a second for the wishlist when signed in.
async function getCurrentUser(): Promise<{ firstName: string | null; savedIds: string[] }> {
  const token = (await cookies()).get('qk_token')?.value
  if (!token) return { firstName: null, savedIds: [] }
  const claims = verifyToken(token)
  if (!claims?.email) return { firstName: null, savedIds: [] }
  try {
    const row = await getUserRowByEmail(claims.email)
    const name = row?.full_name?.trim() || claims.email.split('@')[0]
    const firstName = name ? name.split(' ')[0] : null
    const savedIds = row?.id ? await getWishlistIds(row.id).catch(() => []) : []
    return { firstName, savedIds }
  } catch {
    return { firstName: null, savedIds: [] }
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
    type?: string
  }>
}) {
  const t = await getTranslations('explorePage')
  const locale = await getLocale()
  // Locale-prefix internal links so footer links land on the right page without
  // an extra middleware redirect.
  const loc = (href: string) => `/${locale}${href}`
  const waNumber = (process.env.NEXT_PUBLIC_WHATSAPP || '201000000000').replace(/[^\d]/g, '')
  const sp = await searchParams
  const location = sp.location?.trim() || ''
  const checkIn = sp.checkIn?.trim() || ''
  const checkOut = sp.checkOut?.trim() || ''
  const guestsRaw = sp.guests?.trim() || ''
  const type = sp.type?.trim() || ''
  const guests = guestsRaw ? Number(guestsRaw) : undefined

  const [listings, currentUser] = await Promise.all([
    getListings({
      location: location || undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      guests: guests && Number.isFinite(guests) ? guests : undefined,
      type: type || undefined,
    }),
    getCurrentUser(),
  ])
  const { firstName, savedIds } = currentUser

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
        /* Header: full nav on desktop, logo + bell + hamburger on mobile. */
        .qk-nav-desktop { display: flex; align-items: center; gap: 18px; font-size: 14px; }
        .qk-header-mobile { display: none; align-items: center; gap: 2px; }
        @media (max-width: 820px) {
          .qk-nav-desktop { display: none; }
          .qk-header-mobile { display: flex; }
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
              alt={t('logoAlt')}
              height={40}
              style={{ height: 40, width: 'auto', display: 'block' }}
            />
          </a>

          {/* Right side (desktop ≥820px): notifications, language, host, auth */}
          <nav className="qk-nav-desktop">
            <NotificationsBell />
            <LocaleSwitcher className="font-semibold text-[color:var(--qk-ink,#3a2a23)]" />
            <a
              href="/host"
              style={{
                color: COLORS.ink,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              {t('nav.becomeHost')}
            </a>
            {firstName ? (
              <>
                <a
                  href="/reservations"
                  style={{ color: COLORS.ink, textDecoration: 'none', fontWeight: 600 }}
                >
                  {t('nav.trips')}
                </a>
                <a
                  href="/saved"
                  style={{ color: COLORS.ink, textDecoration: 'none', fontWeight: 600 }}
                >
                  {t('nav.saved')}
                </a>
                <a
                  href="/account"
                  style={{ color: COLORS.ink, textDecoration: 'none', fontWeight: 600 }}
                >
                  {t('nav.greeting', { name: firstName })}
                </a>
                <a
                  href="/api/auth/logout"
                  style={{
                    color: COLORS.muted,
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  {t('nav.logout')}
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
                  {t('nav.login')}
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
                  {t('nav.signup')}
                </a>
              </>
            )}
          </nav>

          {/* Right side (mobile <820px): bell + hamburger that slides out the rest */}
          <div className="qk-header-mobile">
            <NotificationsBell />
            <MobileMenu firstName={firstName} />
          </div>
        </div>
      </header>

      {/* Live search + results grid + map view (client component).
          The server-fetched listings seed the first paint; the client then
          re-fetches /api/local/listings live as the user types/filters. */}
      <ExploreClient
        initialListings={listings}
        initialFilters={{ location, checkIn, checkOut, guests: guestsRaw, type }}
        savedIds={savedIds}
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
              alt={t('logoAlt')}
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
              {t('footer.tagline')}
            </p>
          </div>

          <FooterColumn
            title={t('footer.support.title')}
            links={[
              { label: t('footer.support.helpCenter'), href: loc('/help') },
              { label: t('footer.support.cancellation'), href: loc('/cancellation') },
              { label: t('footer.support.safetyInfo'), href: loc('/safety') },
              { label: t('footer.support.contact'), href: loc('/contact') },
            ]}
          />
          <FooterColumn
            title={t('footer.hosting.title')}
            links={[
              { label: t('footer.hosting.becomeHost'), href: loc('/host') },
              { label: t('footer.hosting.hostResources'), href: loc('/resources') },
              { label: t('footer.hosting.communityForum'), href: loc('/community') },
            ]}
          />
          <FooterColumn
            title={t('footer.about.title')}
            links={[
              { label: t('footer.about.ourStory'), href: loc('/about') },
              { label: t('footer.about.careers'), href: loc('/careers') },
              { label: t('footer.about.press'), href: loc('/newsroom') },
            ]}
          />
        </div>

        {/* Bottom bar: copyright · legal links · WhatsApp */}
        <div
          style={{
            maxWidth: 1200,
            margin: '32px auto 0',
            paddingTop: 22,
            borderTop: '1px solid rgba(246,241,230,0.18)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            fontSize: 13,
            color: 'rgba(246,241,230,0.7)',
          }}
        >
          <span>{t('footer.copyright')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
            <a href={loc('/terms')} style={{ color: 'rgba(246,241,230,0.85)', textDecoration: 'none' }}>{t('footer.legal.terms')}</a>
            <span aria-hidden>·</span>
            <a href={loc('/privacy')} style={{ color: 'rgba(246,241,230,0.85)', textDecoration: 'none' }}>{t('footer.legal.privacy')}</a>
            <span aria-hidden>·</span>
            <a href={loc('/sitemap')} style={{ color: 'rgba(246,241,230,0.85)', textDecoration: 'none' }}>{t('footer.legal.sitemap')}</a>
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                color: COLORS.burgundy, background: COLORS.cream,
                fontWeight: 700, textDecoration: 'none',
                padding: '7px 14px', borderRadius: 999, marginInlineStart: 4,
              }}
            >
              <svg viewBox="0 0 32 32" width="15" height="15" fill="currentColor" aria-hidden="true">
                <path d="M16.004 3C9.383 3 4 8.383 4 15.004c0 2.117.555 4.184 1.61 6.008L4 29l8.184-1.57a11.94 11.94 0 0 0 3.82.63C22.625 28.06 28 22.676 28 16.055 28 8.43 22.625 3 16.004 3zm5.46 14.44c-.3-.15-1.77-.873-2.043-.973-.273-.1-.473-.15-.673.15-.2.297-.772.97-.947 1.17-.173.198-.35.223-.648.075-.3-.15-1.263-.466-2.406-1.485-.888-.792-1.487-1.77-1.662-2.07-.173-.297-.018-.458.13-.606.134-.133.3-.347.448-.52.15-.174.2-.298.3-.497.099-.2.05-.372-.025-.52-.075-.15-.672-1.62-.922-2.22-.243-.583-.49-.504-.672-.513l-.573-.01c-.2 0-.522.074-.796.372-.273.297-1.045 1.02-1.045 2.49 0 1.47 1.07 2.89 1.22 3.09.15.198 2.105 3.213 5.1 4.505.714.308 1.27.492 1.704.63.716.228 1.368.196 1.883.12.574-.086 1.77-.723 2.02-1.42.248-.698.248-1.296.173-1.42-.074-.124-.273-.198-.573-.347z"/>
              </svg>
              {t('footer.whatsapp')}
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
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
          <li key={link.href} style={{ marginBottom: 8 }}>
            <a
              href={link.href}
              style={{
                fontSize: 14,
                color: 'rgba(246,241,230,0.78)',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
