'use client'

// The guest's QR, on their own reservation card.
//
// THE RULE (same on web, iOS and Android): no QR, no pass link and no wallet
// affordance until the reservation is CONFIRMED. While it is pending we say so
// in words instead of rendering a code that leads nowhere. Two independent
// gates, because a code can only exist on a confirmed booking but a confirmed
// booking may still be waiting for its code (legacy rows before the backfill):
//   1. status must be 'confirmed'
//   2. stayPassPath() must return a link — it refuses null/empty/"null" codes
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { isLiveStayStatus, stayPassPath } from '@/lib/stay-code'
import { StayQr } from '@/app/stay/stay-qr'

const C = { burgundy: '#5B0F16', cream: '#F6F1E6', ink: '#2A2220', muted: '#6B6055' }

export function StayPassCard({
  status,
  reservationCode,
  origin,
}: {
  status: string
  /** NULL until the host approves — never coerce this to a string. */
  reservationCode: string | null
  /** Resolved server-side so the QR encodes an absolute URL on this very
   *  deployment, and server and client render the same markup. */
  origin: string
}) {
  const t = useTranslations('stayPass')
  const locale = useLocale()
  const [copied, setCopied] = useState(false)

  // isLiveStayStatus = confirmed OR completed — the same gate the public pass
  // page and both mobile apps use, so a finished stay keeps its pass here too
  // instead of silently vanishing from the web while it still shows on iOS.
  const path = isLiveStayStatus(status) ? stayPassPath(reservationCode, locale) : null

  // Waiting on the host: say what will happen, show no code.
  if (status === 'pending') {
    return (
      <div
        style={{
          marginTop: 14,
          padding: '13px 15px',
          background: C.cream,
          border: `1px solid rgba(91,15,22,0.10)`,
          borderRadius: 14,
        }}
      >
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{t('guest.pendingTitle')}</p>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: C.muted }}>{t('guest.pendingBody')}</p>
      </div>
    )
  }

  // Cancelled / declined / confirmed-without-a-code: nothing to show.
  if (!path) return null

  const url = `${origin}${path}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the link is right there to copy by hand */
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 14,
        marginTop: 14,
        padding: '13px 15px',
        background: C.cream,
        border: `1px solid rgba(91,15,22,0.10)`,
        borderRadius: 14,
      }}
    >
      <StayQr value={url} size={92} title={reservationCode ?? undefined} />
      <div style={{ minWidth: 0, flex: '1 1 180px' }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{t('guest.heading')}</p>
        <p
          style={{
            margin: '2px 0 0',
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: C.burgundy,
          }}
        >
          {reservationCode}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: C.muted }}>{t('guest.scanHint')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
          <a
            href={path}
            style={{
              color: C.burgundy,
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {t('guest.openPass')}
          </a>
          <button
            type="button"
            onClick={copy}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              color: copied ? '#177245' : C.muted,
            }}
          >
            {copied ? t('guest.copied') : t('guest.copyLink')}
          </button>
        </div>
      </div>
    </div>
  )
}
