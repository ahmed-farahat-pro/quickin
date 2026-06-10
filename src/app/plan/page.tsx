// =============================================================================
// /plan — the QuickIn launch plan rendered as a styled HTML page (no Supabase).
// Mirrors LAUNCH-PLAN.md so the roadmap is viewable in the browser.
// =============================================================================
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Launch Plan | QuickIn',
  description: 'Step-by-step readiness plan for shipping QuickIn across Web, iOS and Android.',
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
const STATUS: Record<Status, { label: string; color: string }> = {
  done: { label: '✓ Done', color: C.done },
  now: { label: '⚙ Do now', color: C.burgundy },
  key: { label: '🔑 Needs a key', color: C.key },
}

function Pill({ s }: { s: Status }) {
  const v = STATUS[s]
  return (
    <span
      style={{
        display: 'inline-block',
        background: v.color + '1a',
        color: v.color,
        border: `1px solid ${v.color}40`,
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {v.label}
    </span>
  )
}

function Step({ s, children }: { s: Status; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: `1px solid ${C.tan}` }}>
      <span style={{ marginTop: 1 }}><Pill s={s} /></span>
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

export default function PlanPage() {
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
            <h1 style={{ margin: 0, fontSize: 30, color: C.burgundy }}>Launch Plan</h1>
            <p style={{ margin: '2px 0 0', color: C.muted, fontSize: 14 }}>Ship QuickIn across Web · iOS · Android — four parallel tracks.</p>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0 26px' }}>
          <Pill s="done" /> <Pill s="now" /> <Pill s="key" />
          <span style={{ fontSize: 13, color: C.muted, alignSelf: 'center' }}>· no Supabase · local PostgreSQL → Vercel/Neon for production</span>
        </div>

        {/* Completed this pass */}
        <h2 style={{ fontSize: 20, margin: '0 0 12px' }}>🟢 Completed (Vercel deploy prep)</h2>
        <div className="plan-cards" style={{ marginBottom: 30 }}>
          <Card title="Backend">
            <Step s="done">Migrated data layer <b>psql CLI → <code>pg</code> driver</b> (Vercel/Neon‑ready, parameterized).</Step>
            <Step s="done">Verified listings · search · login · <b>booking insert</b> · reservations.</Step>
            <Step s="done"><code>init.sql</code> (prod schema + seed) · build flags · <b><code>next build</code> passes</b>.</Step>
          </Card>
          <Card title="Web">
            <Step s="done">Per‑page <b>SEO</b> + OG image + favicon.</Step>
            <Step s="done">Error & 404 pages, error banner, mobile‑responsive grids.</Step>
            <Step s="done">Fixed <code>/sitemap.xml</code> 500.</Step>
          </Card>
          <Card title="iOS">
            <Step s="done">App <b>icon</b> (QUICK IN mark).</Step>
            <Step s="done"><code>apiBaseURL</code> = local (debug) / Vercel (release).</Step>
            <Step s="done">Builds clean on iOS 26.</Step>
          </Card>
          <Card title="Android">
            <Step s="done">Adaptive app <b>icon</b> (logo on cream).</Step>
            <Step s="done"><code>BuildConfig.API_BASE_URL</code> per build type.</Step>
            <Step s="done"><b>Release keystore + signed APK</b>; both builds pass.</Step>
          </Card>
        </div>

        {/* Phase 0 */}
        <h2 style={{ fontSize: 20, margin: '0 0 6px' }}>🔑 Phase 0 — keys & accounts (you create these; unblock everything)</h2>
        <p style={{ color: C.muted, fontSize: 14, margin: '0 0 12px' }}>~45 min total. Full how‑to in SETUP.md / OAUTH‑SETUP.md / DEPLOY‑VERCEL.md.</p>
        <Card title="Create first">
          <Step s="key"><b>Google Cloud</b> project + billing.</Step>
          <Step s="key"><b>Google Maps API key</b> (Maps JS · Android SDK · iOS SDK).</Step>
          <Step s="key"><b>Google OAuth client IDs</b> — Web, iOS, Android (+ SHA‑1).</Step>
          <Step s="key"><b>Apple Developer</b> ($99/yr) → App ID + Sign in with Apple + Team.</Step>
          <Step s="key"><b>Vercel Postgres</b> (DATABASE_URL) + <b>domain + HTTPS</b>.</Step>
        </Card>

        {/* Parallel tracks */}
        <h2 style={{ fontSize: 20, margin: '30px 0 12px' }}>The four parallel tracks (what's left)</h2>
        <div className="plan-tracks">
          <Card title="A · Backend / Infra" tag="shared">
            <Step s="now">Harden env: strong <code>AUTH_SECRET</code>, secrets in env only.</Step>
            <Step s="key">Provision <b>prod Postgres</b>; run <code>init.sql</code>; import real data.</Step>
            <Step s="now"><b>Deploy</b> to Vercel; set <code>DATABASE_URL</code> + keys as env.</Step>
            <Step s="now">Decide the public <b>API base URL</b> for the apps.</Step>
            <Step s="now">Later: payments (Stripe), image upload/host, backups, monitoring.</Step>
          </Card>
          <Card title="B · Web">
            <Step s="key">Flip map to <b>Google Maps</b> (paste Maps key).</Step>
            <Step s="key">Turn on <b>Google login</b> (+ Apple via Services ID + HTTPS).</Step>
            <Step s="now">Real listings via admin + listing <b>photo upload</b>.</Step>
            <Step s="now">A11y pass; deploy to the domain.</Step>
          </Card>
          <Card title="C · iOS">
            <Step s="now">Point release <code>apiBaseURL</code> at the Vercel URL.</Step>
            <Step s="key">Xcode signing: set <b>Team</b> + add <b>Sign in with Apple</b>.</Step>
            <Step s="key">(If Google Maps) add Maps iOS SDK + key; add Google iOS client id.</Step>
            <Step s="now">Test on a real device.</Step>
            <Step s="key"><b>TestFlight</b> → App Store review.</Step>
          </Card>
          <Card title="D · Android">
            <Step s="now">Point release <code>API_BASE_URL</code> at the Vercel URL.</Step>
            <Step s="key">Add <b>Maps key</b> (flips from osmdroid).</Step>
            <Step s="key">Add Google client id + register <b>debug & release SHA‑1</b>.</Step>
            <Step s="now">Build signed <b>release AAB</b>; test on a real device.</Step>
            <Step s="key">Play Console → <b>internal testing</b> → submit.</Step>
          </Card>
        </div>

        {/* Do now + definition of ready */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, marginTop: 30 }}>
          <Card title="🚀 Do now, in parallel (no keys)">
            <Step s="now"><b>Backend</b>: deploy‑ready (done) → push to GitHub + import to Vercel.</Step>
            <Step s="now"><b>Web</b>: real data via admin, photo upload, a11y.</Step>
            <Step s="now"><b>iOS</b>: set prod URL, real‑device test.</Step>
            <Step s="now"><b>Android</b>: set prod URL, signed release AAB, device test.</Step>
          </Card>
          <Card title="🏁 Definition of ready to ship">
            <Step s="key">Web live on the domain (HTTPS), real data, Maps + Google/Apple login.</Step>
            <Step s="key">iOS on TestFlight (signed, real login + maps), passing on a device.</Step>
            <Step s="key">Android signed release on Play internal testing, passing on a device.</Step>
            <Step s="now">Production DB with backups; apps pointed at the prod API.</Step>
          </Card>
        </div>

        <p style={{ color: C.muted, fontSize: 13, marginTop: 28 }}>
          Source of truth: <code>LAUNCH-PLAN.md</code> · deploy steps: <code>DEPLOY-VERCEL.md</code> · keys: <code>SETUP.md</code>.
        </p>
      </div>
    </main>
  )
}
