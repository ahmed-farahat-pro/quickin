// Friendly empty state for the public stay pass: an unknown code, or a link
// that carries no code at all (the `/stay/null` case). Deliberately NOT a 404 —
// someone is standing at a door with a phone, so they get a plain explanation
// and a way forward instead of an error page.
import Link from 'next/link'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

export function StayNotice({
  title,
  body,
  cta,
  href,
}: {
  title: string
  body: string
  cta: string
  href: string
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 22,
        border: '1px solid rgba(42,34,32,0.06)',
        boxShadow: '0 6px 24px rgba(42,34,32,0.07)',
        padding: '48px 26px',
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 62,
          height: 62,
          margin: '0 auto 18px',
          borderRadius: 18,
          background: C.tan,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          color: C.burgundy,
        }}
      >
        ⌗
      </div>
      <h1
        style={{
          margin: 0,
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 'clamp(21px, 4.2vw, 27px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: C.burgundy,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: '12px auto 24px',
          maxWidth: 420,
          fontSize: 15,
          lineHeight: 1.65,
          color: C.muted,
        }}
      >
        {body}
      </p>
      <Link
        href={href}
        style={{
          display: 'inline-block',
          background: C.burgundy,
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: 15,
          padding: '12px 28px',
          borderRadius: 999,
        }}
      >
        {cta}
      </Link>
      <p style={{ margin: '18px 0 0', fontSize: 13.5 }}>
        <Link href="/explore" style={{ color: C.muted, textDecoration: 'underline', textUnderlineOffset: 3 }}>
          QuickIn
        </Link>
      </p>
    </div>
  )
}
