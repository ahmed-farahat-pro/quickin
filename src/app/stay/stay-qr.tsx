'use client'

// The only QR renderer on the web. Used for the stay pass itself and for the
// "place" links a host adds to a stay guide. `qrcode.react` is client-only, so
// this thin wrapper keeps the pages that use it server components.
//
// It renders NOTHING for an empty/`null`/"null" value: a QR that encodes a
// broken URL is worse than no QR at all (that bug is exactly what sent guests
// to /stay/null). Callers still gate on booking status — this is the last line.
import { QRCodeSVG } from 'qrcode.react'

const INK = '#2A2220'

export function StayQr({
  value,
  size = 148,
  title,
}: {
  value: string | null | undefined
  size?: number
  /** Accessible name for the code (e.g. the place it links to). */
  title?: string
}) {
  const v = String(value ?? '').trim()
  if (!v || v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') return null

  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 12,
        background: '#fff',
        border: '1px solid rgba(42,34,32,0.10)',
        borderRadius: 16,
        lineHeight: 0,
      }}
    >
      <QRCodeSVG
        value={v}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor={INK}
        title={title}
      />
    </div>
  )
}
