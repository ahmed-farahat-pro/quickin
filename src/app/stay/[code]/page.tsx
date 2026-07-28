// PUBLIC stay pass — the page every QuickIn QR code points at.
//
// Reached as /stay/<code> and, through the app's locale routing, as
// /en|ar|fr|es/stay/<code> (proxy.ts strips the prefix and rewrites here).
// No auth: anyone holding the code — Wallet pass, in-app QR, a printed card —
// must be able to open it, so the query returns display fields only (no booking
// id, no guest email/phone, no prices).
//
// Three states, none of them a raw 404:
//   • a real code            → the pass + the host's stay guide
//   • an unknown code        → "we couldn't find that reservation"
//   • a missing/"null" code  → "this link is missing a reservation code"
// A code only exists once a reservation was CONFIRMED (db.ts issues it at that
// transition), so a pending request can never resolve here.
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  getStayByCode,
  isLiveStayStatus,
  normalizeReservationCode,
  type StayGuideItem,
  type StayPass,
} from '@/lib/local/db'
import { localeToBcp47, type Locale } from '@/i18n/config'
import { stayPassPath } from '@/lib/stay-code'
import { getRequestOrigin } from '@/lib/site-origin'
import { StayQr } from '../stay-qr'
import { StayNotice } from '../stay-notice'

export const dynamic = 'force-dynamic'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'
const SERIF = '"Playfair Display", Georgia, serif'

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('stayPass')
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    // A pass is personal: never index it, never follow out of it.
    robots: { index: false, follow: false },
  }
}

/** Belt-and-braces on render: guide URLs are validated on write, but a link
 *  rendered to a stranger only ever gets an http(s) — or, for files, data: — URL. */
function safeHref(url: string | null | undefined, allowData: boolean): string | null {
  const v = String(url ?? '').trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  if (allowData && /^data:/i.test(v)) return v
  return null
}

/** Next gives us the raw path segment. A truncated or hand-mangled link can
 *  carry a broken percent-escape, and decodeURIComponent throws on those — treat
 *  that as "no usable code" rather than letting it become an error page. */
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return ''
  }
}

function fmtDate(d: string, bcp47: string): string {
  const date = new Date(d + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return d
  return date.toLocaleDateString(bcp47, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function statusChipColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'confirmed': return { bg: '#e7f5ec', fg: '#177245' }
    case 'pending':   return { bg: '#fff7e6', fg: '#9a6b00' }
    case 'rejected':  return { bg: '#fdecea', fg: '#b3261e' }
    default:          return { bg: '#f1efec', fg: C.muted }
  }
}

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 22,
  border: '1px solid rgba(42,34,32,0.06)',
  boxShadow: '0 6px 24px rgba(42,34,32,0.07)',
  overflow: 'hidden',
}

const sectionTitle: React.CSSProperties = {
  margin: '0 0 12px',
  fontFamily: SERIF,
  fontSize: 21,
  fontWeight: 700,
  color: C.burgundy,
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: C.cream,
        color: C.ink,
        fontFamily: FONT,
      }}
    >
      <header
        style={{
          background: `linear-gradient(180deg, ${C.tan} 0%, ${C.cream} 100%)`,
          borderBottom: '1px solid rgba(91,15,22,0.10)',
          padding: '18px 24px',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuickIn" style={{ height: 38, width: 'auto', display: 'block' }} />
        </div>
      </header>
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 72px' }}>{children}</section>
    </main>
  )
}

export default async function StayPassPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: rawCode } = await params
  const t = await getTranslations('stayPass')
  // "null"/"undefined"/empty never reach the database — they are a broken link,
  // not an unknown reservation, and they get their own message.
  const code = normalizeReservationCode(decodeSegment(rawCode ?? ''))
  if (!code) {
    return (
      <Shell>
        <StayNotice
          title={t('missingCode.title')}
          body={t('missingCode.body')}
          cta={t('missingCode.cta')}
          href="/reservations"
        />
      </Shell>
    )
  }

  const pass = await getStayByCode(code)
  if (!pass) {
    return (
      <Shell>
        <StayNotice
          title={t('notFound.title')}
          body={t('notFound.body')}
          cta={t('notFound.cta')}
          href="/reservations"
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <Pass pass={pass} />
    </Shell>
  )
}

async function Pass({ pass }: { pass: StayPass }) {
  const t = await getTranslations('stayPass')
  const locale = (await getLocale()) as Locale
  const bcp47 = localeToBcp47(locale)
  const chip = statusChipColors(pass.status)
  const statusLabel =
    pass.status === 'confirmed' ? t('status.confirmed')
    : pass.status === 'completed' ? t('status.completed')
    : pass.status === 'pending' ? t('status.pending')
    : pass.status === 'cancelled' ? t('status.cancelled')
    : pass.status === 'rejected' ? t('status.rejected')
    : pass.status
  // Same gate as getStayByCode (and as iOS/Android): confirmed OR completed.
  const isLive = isLiveStayStatus(pass.status)
  const place = [pass.location, pass.country].filter(Boolean).join(', ')
  // stayPassPath() is the only place a stay URL is built; it returns null for a
  // missing/"null" code, so the QR below simply doesn't render in that case.
  const passPath = stayPassPath(pass.reservation_code, locale)
  const passUrl = passPath ? `${await getRequestOrigin()}${passPath}` : null

  const info = pass.guide.filter((i) => i.kind === 'info')
  const photos = pass.guide.filter((i) => i.kind === 'photo')
  const places = pass.guide.filter((i) => i.kind === 'place_qr')
  const files = pass.guide.filter((i) => i.kind === 'attachment')

  return (
    <>
      {/* Phones: the three-column date strip stacks. Inline styles can't carry
          media queries, so the few responsive bits live here. */}
      <style>{`
        @media (max-width: 520px) {
          .qk-stay-facts { grid-template-columns: 1fr 1fr !important; }
          .qk-stay-photos { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <article style={card}>
        <div style={{ position: 'relative', height: 190, background: C.tan }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pass.image || FALLBACK_IMG}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <div style={{ padding: '20px 22px 24px' }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: C.muted,
            }}
          >
            {t('heading')}
          </p>
          <h1
            style={{
              margin: '6px 0 0',
              fontFamily: SERIF,
              fontSize: 'clamp(24px, 4.5vw, 32px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: C.burgundy,
            }}
          >
            {pass.title}
          </h1>
          {place && (
            <p style={{ margin: '6px 0 0', fontSize: 15, color: C.muted }}>{place}</p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0 0' }}>
            <span style={{ background: chip.bg, color: chip.fg, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999 }}>
              {statusLabel}
            </span>
            {isLive && pass.payment_status === 'paid' && (
              <span style={{ background: '#e7f5ec', color: '#177245', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999 }}>
                ✓ {t('paid')}
              </span>
            )}
          </div>

          {!isLive && (
            <p
              style={{
                margin: '16px 0 0',
                padding: '11px 14px',
                background: C.cream,
                border: '1px solid rgba(91,15,22,0.10)',
                borderRadius: 14,
                fontSize: 13.5,
                lineHeight: 1.6,
                color: C.muted,
              }}
            >
              {t('inactiveNotice')}
            </p>
          )}

          <div
            className="qk-stay-facts"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 14,
              margin: '20px 0 0',
              paddingTop: 18,
              borderTop: '1px solid rgba(42,34,32,0.08)',
            }}
          >
            <Fact label={t('checkIn')} value={fmtDate(pass.check_in, bcp47)} />
            <Fact label={t('checkOut')} value={fmtDate(pass.check_out, bcp47)} />
            <Fact label={t('guestsLabel')} value={t('guestsCount', { count: pass.guests })} />
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px 16px',
              margin: '18px 0 0',
              paddingTop: 16,
              borderTop: '1px solid rgba(42,34,32,0.08)',
              fontSize: 14,
              color: C.muted,
            }}
          >
            <span>
              {pass.guest_name ? t('greeting', { name: pass.guest_name }) : t('greetingGeneric')}
            </span>
            {pass.host_name && <span>{t('hostedBy', { name: pass.host_name })}</span>}
          </div>

          {/* The pass QR + code. Gated on the booking still being confirmed —
              a cancelled reservation keeps its code but is not a valid pass. */}
          {isLive && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 18,
                margin: '20px 0 0',
                paddingTop: 18,
                borderTop: '1px solid rgba(42,34,32,0.08)',
              }}
            >
              <StayQr value={passUrl} size={120} title={pass.reservation_code} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted }}>
                  {t('codeLabel')}
                </p>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: C.burgundy,
                  }}
                >
                  {pass.reservation_code}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>{t('guest.scanHint')}</p>
              </div>
            </div>
          )}
        </div>
      </article>

      {/* The host's free-text note has always lived on the booking — keep it, but
          behind the SAME gate as the QR and the guide. A cancelled reservation
          keeps its code forever, and this field is where door codes, lockbox
          combinations and key-location directions get written: leaving it public
          hands the place to anyone holding an old link. */}
      {isLive && pass.host_notes && (
        <section style={{ ...card, padding: '20px 22px', marginTop: 20 }}>
          <h2 style={sectionTitle}>{t('hostNotes')}</h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: C.ink, whiteSpace: 'pre-wrap' }}>
            {pass.host_notes}
          </p>
        </section>
      )}

      {/* Everything below is host-authored and rendered as escaped text/attributes —
          no dangerouslySetInnerHTML anywhere on this page. */}
      {isLive && pass.guide.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <h2 style={{ ...sectionTitle, marginBottom: 4 }}>{t('guide.heading')}</h2>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: C.muted }}>{t('guide.subtitle')}</p>

          {info.length > 0 && (
            <section style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted }}>
                {t('guide.info')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {info.map((item) => (
                  <div key={item.id}>
                    {item.title && (
                      <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: C.ink }}>{item.title}</p>
                    )}
                    {item.body && (
                      <p style={{ margin: '3px 0 0', fontSize: 14.5, lineHeight: 1.65, color: C.muted, whiteSpace: 'pre-wrap' }}>
                        {item.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {photos.length > 0 && (
            <section style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted }}>
                {t('guide.photos')}
              </h3>
              <div
                className="qk-stay-photos"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}
              >
                {photos.map((item) => <GuidePhoto key={item.id} item={item} alt={t('guide.photoAlt')} />)}
              </div>
            </section>
          )}

          {places.length > 0 && (
            <section style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted }}>
                {t('guide.places')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {places.map((item) => {
                  const href = safeHref(item.url, false)
                  if (!href) return null
                  return (
                    <div key={item.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                      <StayQr value={href} size={116} title={item.title ?? undefined} />
                      <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                        {item.title && (
                          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: C.ink }}>{item.title}</p>
                        )}
                        {item.body && (
                          <p style={{ margin: '3px 0 0', fontSize: 14, lineHeight: 1.6, color: C.muted, whiteSpace: 'pre-wrap' }}>
                            {item.body}
                          </p>
                        )}
                        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.muted }}>{t('guide.scanHint')}</p>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          style={{
                            display: 'inline-block',
                            marginTop: 10,
                            background: C.burgundy,
                            color: '#fff',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: 13.5,
                            padding: '9px 20px',
                            borderRadius: 999,
                          }}
                        >
                          {t('guide.openLink')}
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {files.length > 0 && (
            <section style={{ ...card, padding: '18px 20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted }}>
                {t('guide.attachments')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {files.map((item) => {
                  const href = safeHref(item.url, true)
                  if (!href) return null
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '11px 14px',
                        background: C.cream,
                        border: '1px solid rgba(91,15,22,0.08)',
                        borderRadius: 14,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: C.ink }}>
                          {item.title || t('guide.attachments')}
                        </p>
                        {item.body && (
                          <p style={{ margin: '2px 0 0', fontSize: 13.5, color: C.muted }}>{item.body}</p>
                        )}
                      </div>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        download={item.title || undefined}
                        style={{
                          color: C.burgundy,
                          fontWeight: 700,
                          fontSize: 13.5,
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t('guide.download')}
                      </a>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>
        {label}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, color: C.ink }}>{value}</p>
    </div>
  )
}

function GuidePhoto({ item, alt }: { item: StayGuideItem; alt: string }) {
  const src = safeHref(item.url, true)
  if (!src) return null
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ aspectRatio: '1 / 1', borderRadius: 14, overflow: 'hidden', background: C.tan }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={item.title || alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      {(item.title || item.body) && (
        <figcaption style={{ margin: '6px 2px 0', fontSize: 12.5, lineHeight: 1.5, color: C.muted }}>
          {item.title || item.body}
        </figcaption>
      )}
    </figure>
  )
}
