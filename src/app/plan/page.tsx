// =============================================================================
// /plan — the QuickIn launch plan rendered as a styled HTML page (no Supabase).
// Mirrors LAUNCH-PLAN.md so the roadmap is viewable in the browser.
// =============================================================================
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('planPage')
  return {
    title: t('meta.title'),
    description: t('meta.description'),
  }
}

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
  done: '#177245',
  key: '#B8860B',
  white: '#ffffff',
}

type Status = 'done' | 'now' | 'key'

function Pill({ s, label }: { s: Status; label: string }) {
  const color = s === 'done' ? C.done : s === 'now' ? C.burgundy : C.key
  return (
    <span
      style={{
        display: 'inline-block',
        background: color + '1a',
        color: color,
        border: `1px solid ${color}40`,
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function Step({ s, label, children }: { s: Status; label: string; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: `1px solid ${C.tan}` }}>
      <span style={{ marginTop: 1 }}><Pill s={s} label={label} /></span>
      <span style={{ fontSize: 14, color: C.ink, lineHeight: 1.45 }}>{children}</span>
    </li>
  )
}

function Card({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.white,
        borderRadius: 20,
        padding: '18px 20px',
        boxShadow: '0 4px 18px rgba(42,34,32,0.07)',
        border: `1px solid ${C.tan}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: C.burgundy }}>{title}</h3>
        {tag && <span style={{ fontSize: 12, color: C.muted }}>{tag}</span>}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{children}</ul>
    </div>
  )
}

export default async function PlanPage() {
  const t = await getTranslations('planPage')
  const richTags = {
    b: (chunks: React.ReactNode) => <b>{chunks}</b>,
    code: (chunks: React.ReactNode) => <code>{chunks}</code>,
  }
  const statusLabels: Record<Status, string> = {
    done: t('status.done'),
    now: t('status.now'),
    key: t('status.key'),
  }
  return (
    <main style={{ minHeight: '100vh', background: C.cream, color: C.ink, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <style>{`
        .plan-wrap{max-width:1080px;margin:0 auto;padding:32px 22px 72px}
        .plan-tracks{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
        .plan-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
        @media (max-width:760px){.plan-tracks{grid-template-columns:1fr}}
      `}</style>
      <div className="plan-wrap">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <img src="/logo.png" alt="QuickIn" style={{ height: 44 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 30, color: C.burgundy }}>{t('header.title')}</h1>
            <p style={{ margin: '2px 0 0', color: C.muted, fontSize: 14 }}>{t('header.subtitle')}</p>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0 26px' }}>
          <Pill s="done" label={statusLabels.done} /> <Pill s="now" label={statusLabels.now} /> <Pill s="key" label={statusLabels.key} />
          <span style={{ fontSize: 13, color: C.muted, alignSelf: 'center' }}>{t('legend.note')}</span>
        </div>

        {/* Completed this pass */}
        <h2 style={{ fontSize: 20, margin: '0 0 12px' }}>{t('completed.heading')}</h2>
        <div className="plan-cards" style={{ marginBottom: 30 }}>
          <Card title={t('completed.backend.title')}>
            <Step s="done" label={statusLabels.done}>{t.rich('completed.backend.migrated', richTags)}</Step>
            <Step s="done" label={statusLabels.done}>{t.rich('completed.backend.verified', richTags)}</Step>
            <Step s="done" label={statusLabels.done}>{t.rich('completed.backend.initSql', richTags)}</Step>
          </Card>
          <Card title={t('completed.web.title')}>
            <Step s="done" label={statusLabels.done}>{t.rich('completed.web.seo', richTags)}</Step>
            <Step s="done" label={statusLabels.done}>{t('completed.web.errorPages')}</Step>
            <Step s="done" label={statusLabels.done}>{t.rich('completed.web.sitemap', richTags)}</Step>
          </Card>
          <Card title={t('completed.ios.title')}>
            <Step s="done" label={statusLabels.done}>{t.rich('completed.ios.icon', richTags)}</Step>
            <Step s="done" label={statusLabels.done}>{t.rich('completed.ios.apiBaseUrl', richTags)}</Step>
            <Step s="done" label={statusLabels.done}>{t('completed.ios.builds')}</Step>
          </Card>
          <Card title={t('completed.android.title')}>
            <Step s="done" label={statusLabels.done}>{t.rich('completed.android.icon', richTags)}</Step>
            <Step s="done" label={statusLabels.done}>{t.rich('completed.android.buildConfig', richTags)}</Step>
            <Step s="done" label={statusLabels.done}>{t.rich('completed.android.keystore', richTags)}</Step>
          </Card>
        </div>

        {/* Phase 0 */}
        <h2 style={{ fontSize: 20, margin: '0 0 6px' }}>{t('phase0.heading')}</h2>
        <p style={{ color: C.muted, fontSize: 14, margin: '0 0 12px' }}>{t('phase0.note')}</p>
        <Card title={t('phase0.cardTitle')}>
          <Step s="key" label={statusLabels.key}>{t.rich('phase0.googleCloud', richTags)}</Step>
          <Step s="key" label={statusLabels.key}>{t.rich('phase0.mapsKey', richTags)}</Step>
          <Step s="key" label={statusLabels.key}>{t.rich('phase0.oauthClients', richTags)}</Step>
          <Step s="key" label={statusLabels.key}>{t.rich('phase0.appleDeveloper', richTags)}</Step>
          <Step s="key" label={statusLabels.key}>{t.rich('phase0.vercelPostgres', richTags)}</Step>
        </Card>

        {/* Parallel tracks */}
        <h2 style={{ fontSize: 20, margin: '30px 0 12px' }}>{t('tracks.heading')}</h2>
        <div className="plan-tracks">
          <Card title={t('tracks.backend.title')} tag={t('tracks.backend.tag')}>
            <Step s="now" label={statusLabels.now}>{t.rich('tracks.backend.hardenEnv', richTags)}</Step>
            <Step s="key" label={statusLabels.key}>{t.rich('tracks.backend.provisionDb', richTags)}</Step>
            <Step s="now" label={statusLabels.now}>{t.rich('tracks.backend.deploy', richTags)}</Step>
            <Step s="now" label={statusLabels.now}>{t.rich('tracks.backend.apiBaseUrl', richTags)}</Step>
            <Step s="now" label={statusLabels.now}>{t('tracks.backend.later')}</Step>
          </Card>
          <Card title={t('tracks.web.title')}>
            <Step s="key" label={statusLabels.key}>{t.rich('tracks.web.flipMap', richTags)}</Step>
            <Step s="key" label={statusLabels.key}>{t.rich('tracks.web.googleLogin', richTags)}</Step>
            <Step s="now" label={statusLabels.now}>{t.rich('tracks.web.realListings', richTags)}</Step>
            <Step s="now" label={statusLabels.now}>{t('tracks.web.a11y')}</Step>
          </Card>
          <Card title={t('tracks.ios.title')}>
            <Step s="now" label={statusLabels.now}>{t.rich('tracks.ios.apiBaseUrl', richTags)}</Step>
            <Step s="key" label={statusLabels.key}>{t.rich('tracks.ios.signing', richTags)}</Step>
            <Step s="key" label={statusLabels.key}>{t('tracks.ios.maps')}</Step>
            <Step s="now" label={statusLabels.now}>{t('tracks.ios.device')}</Step>
            <Step s="key" label={statusLabels.key}>{t.rich('tracks.ios.testflight', richTags)}</Step>
          </Card>
          <Card title={t('tracks.android.title')}>
            <Step s="now" label={statusLabels.now}>{t.rich('tracks.android.apiBaseUrl', richTags)}</Step>
            <Step s="key" label={statusLabels.key}>{t.rich('tracks.android.mapsKey', richTags)}</Step>
            <Step s="key" label={statusLabels.key}>{t.rich('tracks.android.clientId', richTags)}</Step>
            <Step s="now" label={statusLabels.now}>{t.rich('tracks.android.releaseAab', richTags)}</Step>
            <Step s="key" label={statusLabels.key}>{t.rich('tracks.android.playConsole', richTags)}</Step>
          </Card>
        </div>

        {/* Do now + definition of ready */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, marginTop: 30 }}>
          <Card title={t('doNow.title')}>
            <Step s="now" label={statusLabels.now}>{t.rich('doNow.backend', richTags)}</Step>
            <Step s="now" label={statusLabels.now}>{t.rich('doNow.web', richTags)}</Step>
            <Step s="now" label={statusLabels.now}>{t.rich('doNow.ios', richTags)}</Step>
            <Step s="now" label={statusLabels.now}>{t.rich('doNow.android', richTags)}</Step>
          </Card>
          <Card title={t('ready.title')}>
            <Step s="key" label={statusLabels.key}>{t('ready.web')}</Step>
            <Step s="key" label={statusLabels.key}>{t('ready.ios')}</Step>
            <Step s="key" label={statusLabels.key}>{t('ready.android')}</Step>
            <Step s="now" label={statusLabels.now}>{t('ready.db')}</Step>
          </Card>
        </div>

        <p style={{ color: C.muted, fontSize: 13, marginTop: 28 }}>
          {t.rich('footer.source', richTags)}
        </p>
      </div>
    </main>
  )
}
