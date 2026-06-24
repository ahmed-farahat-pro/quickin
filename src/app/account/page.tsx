// Account settings (no Supabase) — the signed-in user's profile + security.
// Server-resolves the user from the qk_token cookie (same pattern as
// explore/page.tsx + reservations/page.tsx); redirects to /login when absent.
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getVerification } from '@/lib/local/db'
import { verifyToken, getUserRowByEmail } from '@/lib/local/auth'
import { AccountForms } from './account-forms'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your account · QuickIn',
  description: 'Manage your QuickIn profile, identity verification and password.',
  alternates: { canonical: '/account' },
  robots: { index: false, follow: true },
}

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

interface AccountUser {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

// Resolve the signed-in user (full row), or null when the cookie is missing/invalid.
async function getCurrentUser(): Promise<AccountUser | null> {
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
      avatar_url: row.avatar_url,
    }
  } catch {
    return null
  }
}

const VERIFY_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  verified: { bg: '#e7f5ec', fg: '#177245', label: 'Verified' },
  pending: { bg: '#fff7e6', fg: '#9a6b00', label: 'Pending review' },
  rejected: { bg: '#fdecea', fg: '#b3261e', label: 'Not approved' },
  unverified: { bg: '#f1efec', fg: COLORS.muted, label: 'Not verified' },
}

function initials(name: string | null, email: string): string {
  const base = (name?.trim() || email.split('@')[0] || '?').trim()
  const parts = base.split(/\s+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 2)
  return letters.toUpperCase()
}

function Header() {
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
          href="/explore"
          style={{
            color: COLORS.burgundy,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ← Back to explore
        </a>
      </div>
    </header>
  )
}

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const verification = await getVerification(user.id)
  const chip = VERIFY_CHIP[verification.status] ?? VERIFY_CHIP.unverified
  const displayName = user.full_name?.trim() || user.email.split('@')[0]

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: FONT,
      }}
    >
      <Header />

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
            Account
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: COLORS.muted }}>
            Manage your profile, identity and password.
          </p>
        </div>

        {/* Identity card: avatar + name + email + verification status */}
        <div
          style={{
            background: '#fff',
            borderRadius: 22,
            border: `1px solid rgba(42,34,32,0.06)`,
            boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: COLORS.tan,
              color: COLORS.burgundy,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 24,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              initials(user.full_name, user.email)
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.ink }}>
              {displayName}
            </div>
            <div style={{ fontSize: 14, color: COLORS.muted, wordBreak: 'break-all' }}>
              {user.email}
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-block',
                  background: chip.bg,
                  color: chip.fg,
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: 999,
                }}
              >
                {chip.label}
              </span>
              {verification.status !== 'verified' && (
                <a
                  href="/verify-id"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: COLORS.burgundy,
                    textDecoration: 'none',
                  }}
                >
                  Verify your ID →
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Profile + password forms (client) */}
        <AccountForms
          userId={user.id}
          initialName={user.full_name ?? ''}
          initialAvatar={user.avatar_url ?? ''}
        />

        {/* Quick links to the rest of the account surface */}
        <div
          style={{
            background: '#fff',
            borderRadius: 22,
            border: `1px solid rgba(42,34,32,0.06)`,
            boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
            padding: '12px 8px',
          }}
        >
          <AccountLink href="/reservations" label="Your reservations" />
          <AccountLink href="/saved" label="Saved stays" />
          <AccountLink href="/verify-id" label="Identity verification" />
          <AccountLink href="/host" label="Hosting" />
        </div>

        {/* Logout */}
        <div style={{ textAlign: 'center' }}>
          <a
            href="/api/auth/logout"
            style={{
              display: 'inline-block',
              color: COLORS.burgundy,
              background: 'transparent',
              border: `1px solid rgba(91,15,22,0.30)`,
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 14,
              padding: '11px 28px',
              borderRadius: 999,
            }}
          >
            Log out
          </a>
        </div>
      </section>
    </main>
  )
}

function AccountLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        margin: '2px 0',
        borderRadius: 14,
        textDecoration: 'none',
        color: COLORS.ink,
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      <span>{label}</span>
      <span style={{ color: COLORS.muted, fontWeight: 700 }}>→</span>
    </a>
  )
}
