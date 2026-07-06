'use client'

// Terms & Conditions page — the guest/tenant and host agreements (English +
// Arabic, Arabic governing) with a Guest ↔ Host toggle. Content lives in
// terms-data.ts; this component handles the toggle + boutique presentation.
import { useState } from 'react'
import Link from 'next/link'
import { sectionsFor, type Audience } from './terms-data'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const T = {
  en: {
    title: 'Terms & Conditions',
    guestSub: 'Guest Agreement — general provisions governing the relationship between the Company and the Guest.',
    hostSub: 'Host Agreement — general provisions governing the relationship between the Company and the Host.',
    updated: 'Last updated: 6 July 2026',
    govNote:
      'This agreement is issued in Arabic and English. In the event of any conflict or discrepancy between the two texts, the Arabic text shall prevail and govern interpretation and application.',
    back: 'Back to Explore',
    guest: 'Guest',
    host: 'Host',
    toggleAria: 'Choose which agreement to view',
  },
  ar: {
    title: 'الشروط والأحكام',
    guestSub: 'اتفاقية المستأجر — الأحكام العامة المنظمة للعلاقة بين الشركة والمستأجر.',
    hostSub: 'اتفاقية المؤجر — الأحكام العامة المنظمة للعلاقة بين الشركة والمؤجر.',
    updated: 'آخر تحديث: ٦ يوليو ٢٠٢٦',
    govNote:
      'تم تحرير هذه الاتفاقية باللغتين العربية والإنجليزية، وفي حال وجود أي تعارض بين النصين، تكون العبرة بالنص العربي باعتباره النص الحاكم.',
    back: 'العودة إلى الاستكشاف',
    guest: 'المستأجر',
    host: 'المؤجر',
    toggleAria: 'اختر الاتفاقية المراد عرضها',
  },
}

export function TermsPage({ locale }: { locale: string }) {
  const isAr = locale === 'ar'
  const s = isAr ? T.ar : T.en
  const dir = isAr ? 'rtl' : 'ltr'
  const [audience, setAudience] = useState<Audience>('guest')
  const sections = sectionsFor(audience, isAr)
  const subtitle = audience === 'host' ? s.hostSub : s.guestSub

  const toggleBtn = (a: Audience, label: string): React.CSSProperties => ({
    flex: '1 1 0',
    padding: '10px 18px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14.5,
    fontWeight: 700,
    color: audience === a ? '#fff' : C.ink,
    background: audience === a ? C.burgundy : 'transparent',
    transition: 'background .16s ease, color .16s ease',
    whiteSpace: 'nowrap',
  })

  return (
    <article
      dir={dir}
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '48px 24px 80px',
        textAlign: isAr ? 'right' : 'left',
        fontFamily: isAr
          ? '"Noto Sans Arabic", "DM Sans", ui-sans-serif, system-ui, sans-serif'
          : '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: C.burgundy,
            background: 'rgba(91,15,22,0.07)',
            borderRadius: 999,
            padding: '6px 13px',
            marginBottom: 14,
          }}
        >
          {s.updated}
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: isAr ? 'inherit' : '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(30px, 5vw, 44px)',
            fontWeight: 800,
            letterSpacing: isAr ? 0 : '-0.02em',
            color: C.burgundy,
            lineHeight: 1.1,
          }}
        >
          {s.title}
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 16, lineHeight: 1.7, color: C.muted, maxWidth: 660 }}>
          {subtitle}
        </p>
      </div>

      {/* Guest / Host toggle */}
      <div
        role="tablist"
        aria-label={s.toggleAria}
        style={{
          display: 'flex',
          gap: 4,
          background: C.tan,
          borderRadius: 999,
          padding: 4,
          maxWidth: 320,
          marginBottom: 26,
        }}
      >
        <button type="button" role="tab" aria-selected={audience === 'guest'} onClick={() => setAudience('guest')} style={toggleBtn('guest', s.guest)}>
          {s.guest}
        </button>
        <button type="button" role="tab" aria-selected={audience === 'host'} onClick={() => setAudience('host')} style={toggleBtn('host', s.host)}>
          {s.host}
        </button>
      </div>

      {/* Governing-language note */}
      <div
        style={{
          background: C.cream,
          border: `1px solid ${C.tan}`,
          borderRadius: 14,
          padding: '14px 18px',
          fontSize: 13.5,
          lineHeight: 1.7,
          color: C.ink,
          marginBottom: 30,
        }}
      >
        {s.govNote}
      </div>

      {/* Document */}
      <div
        style={{
          background: '#fff',
          borderRadius: 22,
          border: '1px solid rgba(42,34,32,0.07)',
          boxShadow: '0 8px 30px rgba(42,34,32,0.07)',
          padding: 'clamp(22px, 4vw, 40px)',
        }}
      >
        {sections.map((section, si) => (
          <section key={`${audience}-${si}`} style={{ marginTop: si === 0 ? 0 : 40 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 20,
                flexDirection: isAr ? 'row-reverse' : 'row',
              }}
            >
              <span style={{ width: 30, height: 3, background: C.burgundy, borderRadius: 3, flex: '0 0 auto' }} />
              <h2 style={{ margin: 0, fontSize: 'clamp(17px, 2.4vw, 21px)', fontWeight: 800, color: C.burgundy, lineHeight: 1.35 }}>
                {section.title}
              </h2>
            </div>

            {section.articles.map((art, ai) => (
              <div key={art.n} style={{ padding: '18px 0', borderTop: ai === 0 ? 'none' : '1px solid rgba(42,34,32,0.08)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 10,
                    flexDirection: isAr ? 'row-reverse' : 'row',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: '0 0 auto',
                      minWidth: 34,
                      height: 34,
                      padding: '0 9px',
                      borderRadius: 10,
                      background: C.burgundy,
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {art.n}
                  </span>
                  <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: C.ink, lineHeight: 1.4 }}>
                    {art.title}
                  </h3>
                </div>
                {art.paras.map((p, pi) => (
                  <p
                    key={pi}
                    style={{
                      margin: pi === 0 ? '0' : '10px 0 0',
                      fontSize: 15,
                      lineHeight: 1.9,
                      color: '#3a3330',
                      textAlign: isAr ? 'right' : 'justify',
                    }}
                  >
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>

      {/* Back link */}
      <div style={{ marginTop: 36 }}>
        <Link
          href={`/${locale}/explore`}
          style={{
            display: 'inline-block',
            background: C.burgundy,
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
            borderRadius: 999,
            padding: '12px 28px',
          }}
        >
          {s.back}
        </Link>
      </div>
    </article>
  )
}
