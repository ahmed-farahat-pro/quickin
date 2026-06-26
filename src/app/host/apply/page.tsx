// Become-a-host application (no Supabase) — an admin-reviewed application, NOT
// an instant flip. Server-resolves the signed-in user from the qk_token cookie:
//   - not signed in           → redirect('/login')
//   - already a host          → redirect('/host')
//   - pending application      → calm "under review" state (read-only)
//   - otherwise               → the application form (client component)
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getHostApplication } from '@/lib/local/db'
import { verifyToken, getUserRowByEmail } from '@/lib/local/auth'
import { ApplyForm } from './apply-form'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('hostApply')
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/host/apply' },
    robots: { index: false, follow: true },
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

interface ApplyUser {
  id: string
  email: string
  full_name: string | null
  is_host: boolean
}

async function getCurrentUser(): Promise<ApplyUser | null> {
  const token = (await cookies()).get('qk_token')?.value
  if (!token) return null
  const claims = verifyToken(token)
  if (!claims?.email) return null
  try {
    const row = await getUserRowByEmail(claims.email)
    if (!row) return null
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      is_host: !!row.is_host,
    }
  } catch {
    return null
  }
}

function Header({ backLabel }: { backLabel: string }) {
  return (
    <header
      style={{
        background: `linear-gradient(180deg, ${COLORS.tan} 0%, ${COLORS.cream} 100%)`,
        borderBottom: `1px solid rgba(91,15,22,0.10)`,
        padding: '20px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <a href="/explore" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <img
            src="/logo.png"
            alt="QuickIn"
            height={40}
            style={{ height: 40, width: 'auto', display: 'block' }}
          />
        </a>
        <a
          href="/account"
          style={{
            color: COLORS.burgundy,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ← {backLabel}
        </a>
      </div>
    </header>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function HostApplyPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.is_host) redirect('/host')

  const t = await getTranslations('hostApply')
  const application = await getHostApplication(user.id)
  const pending = application?.status === 'pending'

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: FONT,
      }}
    >
      <Header backLabel={t('backToAccount')} />

      <section
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '36px 24px 72px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: '0 0 6px',
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 'clamp(26px, 4vw, 34px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: COLORS.burgundy,
            }}
          >
            {t('title')}
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: COLORS.muted, lineHeight: 1.55 }}>
            {pending ? t('pending.subtitle') : t('subtitle')}
          </p>
        </div>

        {pending && application ? (
          <div
            style={{
              background: '#fff',
              borderRadius: 22,
              border: `1px solid rgba(42,34,32,0.06)`,
              boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
              padding: '28px 26px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                background: '#fff7e6',
                color: '#9a6b00',
                fontSize: 12.5,
                fontWeight: 700,
                padding: '5px 14px',
                borderRadius: 999,
              }}
            >
              {t('pending.badge')}
            </span>
            <h2 style={{ margin: '16px 0 6px', fontSize: 19, fontWeight: 700, color: COLORS.ink }}>
              {t('pending.title')}
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14.5, color: COLORS.muted, lineHeight: 1.6 }}>
              {t('pending.body')}
            </p>

            <dl style={{ margin: 0, display: 'grid', gap: 14 }}>
              <SummaryRow label={t('fields.fullName')} value={application.full_name} />
              <SummaryRow label={t('fields.nationalId')} value={application.national_id} />
              <SummaryRow label={t('fields.phone')} value={application.phone} />
              <SummaryRow label={t('fields.address')} value={application.address} />
              {application.company && (
                <SummaryRow label={t('fields.company')} value={application.company} />
              )}
              {application.notes && (
                <SummaryRow label={t('fields.notes')} value={application.notes} />
              )}
              <SummaryRow
                label={t('pending.submittedAt')}
                value={application.submitted_at ? formatDate(application.submitted_at) : null}
              />
            </dl>
          </div>
        ) : (
          <ApplyForm initialName={user.full_name ?? ''} />
        )}
      </section>
    </main>
  )
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <dt style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.muted, letterSpacing: '0.02em' }}>
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: 15, color: COLORS.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {value || '—'}
      </dd>
    </div>
  )
}
