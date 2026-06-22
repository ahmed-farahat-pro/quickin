// Friendly, brand-styled 404 for the local browse experience. Renders when a
// listing under /explore/[id] calls notFound() (e.g. an unknown stay id).
// Self-contained inline styles keep it independent of Tailwind.
import { getTranslations } from 'next-intl/server'

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

export default async function ExploreNotFound() {
  const t = await getTranslations('explorePage')
  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: FONT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <img
          src="/logo.png"
          alt={t('logoAlt')}
          style={{ height: 46, width: 'auto', margin: '0 auto 28px', display: 'block' }}
        />
        <p
          style={{
            margin: 0,
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1,
            color: COLORS.tan,
          }}
        >
          404
        </p>
        <h1
          style={{
            margin: '12px 0 0',
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(22px, 4.5vw, 30px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: COLORS.burgundy,
          }}
        >
          {t('notFound.title')}
        </h1>
        <p style={{ margin: '12px 0 28px', fontSize: 15, lineHeight: 1.6, color: COLORS.muted }}>
          {t('notFound.description')}
        </p>
        <a
          href="/explore"
          style={{
            display: 'inline-block',
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 700,
            color: '#fff',
            background: COLORS.burgundy,
            textDecoration: 'none',
            borderRadius: 999,
            padding: '12px 30px',
          }}
        >
          {t('notFound.browseStays')}
        </a>
      </div>
    </main>
  )
}
