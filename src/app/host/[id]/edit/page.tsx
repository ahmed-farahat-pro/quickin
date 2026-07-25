// Host: edit ONE OF YOUR OWN listings (local-stack, no Supabase). Server-side it
// verifies the qk_token cookie AND that the listing belongs to the signed-in
// host; a stranger's listing 404s. The client form PATCHes /api/local/listings/:id.
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getListingById } from '@/lib/local/db'
import { verifyToken, getUserRowByEmail } from '@/lib/local/auth'
import { EditListingForm } from './edit-listing-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Edit listing · QuickIn',
  robots: { index: false, follow: false },
}

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}
const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

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
            ← Back to host
          </a>
          <a href={`/explore/${listing.id}`} style={{ color: COLORS.burgundy, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            View listing ↗
          </a>
        </div>
      </header>

      <section style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 72px' }}>
        <h1
          style={{
            margin: '0 0 6px',
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(24px, 4vw, 32px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: COLORS.burgundy,
          }}
        >
          Edit listing
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 15, color: COLORS.muted }}>
          Update the details guests see. Changes go live immediately.
        </p>
        <EditListingForm listing={listing} />
      </section>
    </main>
  )
}
