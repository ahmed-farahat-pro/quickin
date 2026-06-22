// Identity verification (no Supabase) — upload a National ID for auto-scan or
// manual admin review. Reachable at /{locale}/verify-id via the locale proxy.
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { IdVerificationPanel } from '@/components/features/verification/id-verification-panel'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('verifyIdPage')
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/verify-id' },
    robots: { index: false, follow: true },
  }
}

export default async function VerifyIdPage() {
  const t = await getTranslations('verifyIdPage')
  return (
    <main style={{ background: '#F6F1E6', minHeight: '100vh' }} className="px-4 py-10">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#5B0F16' }}>
            {t('heading')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <IdVerificationPanel />
      </div>
    </main>
  )
}
