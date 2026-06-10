// Metadata wrapper for the (client-component) signup page.
// `export const metadata` is only allowed in server files, so the page itself
// stays a client component and this thin server layout carries the SEO tags.
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create your account',
  description:
    'Join QuickIn to discover and book a curated collection of boutique vacation rentals.',
  alternates: { canonical: '/signup' },
  openGraph: {
    title: 'Create your account | QuickIn',
    description:
      'Join QuickIn to discover and book a curated collection of boutique vacation rentals.',
    url: '/signup',
    type: 'website',
    siteName: 'QuickIn',
    images: [{ url: '/logo.png', width: 700, height: 454, alt: 'QuickIn' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Create your account | QuickIn',
    description:
      'Join QuickIn to discover and book a curated collection of boutique vacation rentals.',
    images: ['/logo.png'],
  },
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
