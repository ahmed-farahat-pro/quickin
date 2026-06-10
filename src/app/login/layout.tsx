// Metadata wrapper for the (client-component) login page.
// `export const metadata` is only allowed in server files, so the page itself
// stays a client component and this thin server layout carries the SEO tags.
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log in',
  description:
    'Sign in to your QuickIn account to manage reservations and book boutique stays.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Log in | QuickIn',
    description:
      'Sign in to your QuickIn account to manage reservations and book boutique stays.',
    url: '/login',
    type: 'website',
    siteName: 'QuickIn',
    images: [{ url: '/logo.png', width: 700, height: 454, alt: 'QuickIn' }],
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
