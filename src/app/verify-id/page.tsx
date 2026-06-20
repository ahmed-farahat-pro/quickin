// Identity verification (no Supabase) — upload a National ID for auto-scan or
// manual admin review. Reachable at /{locale}/verify-id via the locale proxy.
import type { Metadata } from 'next'
import { IdVerificationPanel } from '@/components/features/verification/id-verification-panel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Verify your identity',
  description: 'Upload your National ID to verify your QuickIn account.',
  alternates: { canonical: '/verify-id' },
  robots: { index: false, follow: true },
}

export default function VerifyIdPage() {
  return (
    <main style={{ background: '#F6F1E6', minHeight: '100vh' }} className="px-4 py-10">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#5B0F16' }}>
            Verify your identity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Boutique stays need a verified guest — it only takes a minute.
          </p>
        </div>
        <IdVerificationPanel />
      </div>
    </main>
  )
}
