// Host: edit ONE OF YOUR OWN listings (local-stack, no Supabase). Server-side it
// verifies the qk_token cookie AND that the listing belongs to the signed-in
// host; a stranger's listing 404s. The client form PATCHes /api/local/listings/:id,
// which sends the listing back to the admin queue on every edit — the form warns
// about that before the host commits, and this header carries the same
// approval-status chip the host dashboard uses.
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getListingById, hostListingHasOwnershipDoc } from '@/lib/local/db'
import { verifyToken, getUserRowByEmail } from '@/lib/local/auth'
import { ListingStatusChip } from '../../listing-status-chip'
import type { HostListingStatus } from '../../host-tabs'
import { EditListingForm } from './edit-listing-form'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('hostPage.edit')
  return {
    title: t('meta.title'),
    robots: { index: false, follow: false },
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

/** Legacy rows have no approval_status — treat anything unknown as published
 *  (same rule as the host dashboard). */
function listingStatus(approval: string | null | undefined): HostListingStatus {
  return approval === 'pending' || approval === 'rejected' ? approval : 'approved'
}

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const token = (await cookies()).get('qk_token')?.value
  if (!token) redirect('/login')
  const claims = verifyToken(token)
  if (!claims?.email) redirect('/login')
  const me = await getUserRowByEmail(claims.email)
  if (!me) redirect('/login')

  const listing = await getListingById(id)
  // Only the owner may edit — anyone else (or a missing listing) gets a 404.
  if (!listing || listing.host_id !== me.id) notFound()
  // Just a flag — the document itself is admin-only (reviewed in /ops).
  const hasOwnershipDoc = await hostListingHasOwnershipDoc(listing.id, me.id)

  const t = await getTranslations('hostPage.edit')
  const tDash = await getTranslations('hostPage.dashboard')
  const status = listingStatus(listing.approval_status)
  const statusLabel: Record<HostListingStatus, string> = {
    approved: tDash('filters.published'),
    pending: tDash('badge.pending'),
    rejected: tDash('badge.rejected'),
  }

  return (
    <main style={{ minHeight: '100vh', background: COLORS.cream, color: COLORS.ink, fontFamily: FONT }}>
      <header
        style={{
          background: `linear-gradient(180deg, ${COLORS.tan} 0%, ${COLORS.cream} 100%)`,
          borderBottom: `1px solid rgba(91,15,22,0.10)`,
          padding: '20px 24px',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <a href="/host" style={{ color: COLORS.burgundy, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            ← {t('backToHost')}
          </a>
          <a href={`/explore/${listing.id}`} style={{ color: COLORS.burgundy, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            {t('viewListing')} ↗
          </a>
        </div>
      </header>

      <section style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 72px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 6px' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 'clamp(24px, 4vw, 32px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: COLORS.burgundy,
            }}
          >
            {t('title')}
          </h1>
          <ListingStatusChip status={status} label={statusLabel[status]} />
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 15, color: COLORS.muted, lineHeight: 1.55 }}>
          {t('subtitle')}
        </p>
        <EditListingForm listing={listing} hasOwnershipDoc={hasOwnershipDoc} />
      </section>
    </main>
  )
}
