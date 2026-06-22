// Metadata wrapper for the (client-component) login page.
// `export const metadata` is only allowed in server files, so the page itself
// stays a client component and this thin server layout carries the SEO tags.
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('loginLocal')
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/login' },
    robots: { index: false, follow: true },
    openGraph: {
      title: t('meta.ogTitle'),
      description: t('meta.description'),
      url: '/login',
      type: 'website',
      siteName: t('meta.siteName'),
      images: [{ url: '/logo.png', width: 700, height: 454, alt: t('meta.imageAlt') }],
    },
  }
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
