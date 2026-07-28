// /stay with no code at all (and /en/stay, via the locale rewrite in proxy.ts).
// A QR that lost its code, a hand-typed URL, a link that was truncated in a
// message — all land here. Same friendly treatment as an unknown code: explain
// it, point at the guest's reservations. Never a raw 404.
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { StayNotice } from './stay-notice'

export const dynamic = 'force-dynamic'

const C = { cream: '#F6F1E6', tan: '#EFE6D8', ink: '#2A2220' }
const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('stayPass')
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    robots: { index: false, follow: false },
  }
}

export default async function StayIndexPage() {
  const t = await getTranslations('stayPass')
  return (
    <main style={{ minHeight: '100vh', background: C.cream, color: C.ink, fontFamily: FONT }}>
      <header
        style={{
          background: `linear-gradient(180deg, ${C.tan} 0%, ${C.cream} 100%)`,
          borderBottom: `1px solid rgba(91,15,22,0.10)`,
          padding: '18px 24px',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuickIn" style={{ height: 38, width: 'auto', display: 'block' }} />
        </div>
      </header>
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 72px' }}>
        <StayNotice
          title={t('missingCode.title')}
          body={t('missingCode.body')}
          cta={t('missingCode.cta')}
          href="/reservations"
        />
      </section>
    </main>
  )
}
