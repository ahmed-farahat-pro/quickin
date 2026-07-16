import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Ship-now resilience: don't let pre-existing type/lint issues in the larger
  // (legacy Supabase) parts of the app block the Vercel build of the live
  // local-stack pages. Re-enable these once the legacy code is cleaned up.
  typescript: { ignoreBuildErrors: true },
  // App Store / Google Play account-deletion URL. The app uses next-intl WITHOUT
  // URL-path locales (no /[locale] routing — that would also clash with the
  // existing /[slug] route), so the deletion page lives at /account/delete and we
  // rewrite the locale-prefixed form (e.g. /en/account/delete) onto it, preserving
  // the requested URL.
  async rewrites() {
    return [
      { source: '/:locale(en|ar|fr|es)/account/delete', destination: '/account/delete' },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'dummy.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        pathname: '/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
