// Metadata wrapper for the (client-component) signup page.
// `export const metadata` is only allowed in server files, so the page itself
// stays a client component and this thin server layout carries the SEO tags.
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signupLocal')
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/signup' },
    openGraph: {
      title: t('meta.ogTitle'),
      description: t('meta.description'),
      url: '/signup',
      type: 'website',
      siteName: 'QuickIn',
      images: [{ url: '/logo.png', width: 700, height: 454, alt: 'QuickIn' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta.ogTitle'),
      description: t('meta.description'),
      images: ['/logo.png'],
    },
  }
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
