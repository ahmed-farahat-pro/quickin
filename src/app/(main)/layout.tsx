import { Suspense, type ComponentProps } from "react";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { Navbar, Footer, BannersStack } from "@/components/layout";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ChatWidget } from "@/components/features/ai";
import { AuthModal } from "@/components/features/auth";
import { SearchBar } from "@/components/features/search/search-bar";
import { MobileMenu } from "@/app/explore/mobile-menu";
import { Button } from "@/components/ui/button";
import { getAttributes, getDestinations } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { verifyToken, getUserRowByEmail } from "@/lib/local/auth";
import { localizeHrefWithQuery } from "@/lib/i18n/pathname";
import type { Locale } from "@/i18n/config";

// The header below reflects the signed-in viewer, which is derived from the
// per-request `qk_token` cookie — so this subtree must never be served from a
// prerendered/static cache (otherwise a signed-in user gets signed-out chrome).
export const dynamic = 'force-dynamic'

type Viewer = { firstName: string; isHost: boolean }

// Resolve the signed-in viewer server-side from the `qk_token` cookie — the same
// local-stack pattern the explore header uses. `<Navbar>` can't do this itself:
// it's a client component that asks Supabase auth, which is dormant in the live
// app, so it always rendered the signed-out chrome (person icon + "Log in").
async function getViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get('qk_token')?.value
  if (!token) return null
  const claims = verifyToken(token)
  if (!claims?.email) return null
  try {
    const row = await getUserRowByEmail(claims.email)
    const name = row?.full_name?.trim() || claims.email.split('@')[0]
    const firstName = name ? name.split(' ')[0] : ''
    if (!firstName) return null
    return { firstName, isHost: !!row?.is_host }
  } catch {
    return null
  }
}

// Signed-in variant of the `(main)` header. Same shell/typography as <Navbar>
// (cream bar, centred nav, "Rent" pill, language switcher) but the signed-out
// affordances — the generic person icon and the Sign up / Log in menu — are
// replaced by the viewer's name, their trips/wishlists and a logout link.
async function SignedInHeader({
  viewer,
  attributes,
  destinations,
  config,
}: ComponentProps<typeof Navbar> & { viewer: Viewer }) {
  const locale = (await getLocale()) as Locale
  const t = await getTranslations('nav')
  const commonT = await getTranslations('common')
  const exploreT = await getTranslations('explorePage')
  const localizedHref = (href: string) => localizeHrefWithQuery(href, locale)

  const navLink = 'text-muted-foreground hover:text-foreground transition-colors'
  const utilityLink =
    'hidden lg:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'

  return (
    <header className='sticky top-0 z-50 w-full transition-all duration-300 bg-[#F6F1E6] border-b border-[#E2D8C8]'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex h-20 items-center justify-between'>
          {/* Logo */}
          <Link href={localizedHref('/')} className='flex items-center gap-3'>
            <Image
              src='/logo.png'
              alt={commonT('brand')}
              width={256}
              height={256}
              className='h-14 w-auto'
            />
          </Link>

          {/* Mobile Search Button */}
          <div className='md:hidden flex justify-center'>
            <SearchBar
              className='w-full max-w-sm'
              attributes={attributes}
              destinations={destinations}
            />
          </div>

          {/* Navigation Links - Centered, Desktop Only */}
          <nav className='hidden md:flex items-center justify-center flex-1 gap-8 text-sm font-medium ar:text-lg ar:font-bold'>
            {config?.links && config.links.length > 0 ? (
              config.links.map((link) => (
                <Link
                  key={link.id}
                  href={localizedHref(link.href)}
                  target={link.is_external ? '_blank' : undefined}
                  rel={link.is_external ? 'noopener noreferrer' : undefined}
                  className={navLink}
                >
                  {link.label[locale as 'en' | 'ar'] || link.label.en}
                </Link>
              ))
            ) : (
              <>
                <Link href={localizedHref('/')} className={navLink}>
                  {t('anywhere')}
                </Link>
                <Link href={localizedHref('/explore')} className={navLink}>
                  {t('listings')}
                </Link>
                <Link href={localizedHref('/services')} className={navLink}>
                  {t('servicesManagement')}
                </Link>
                {/* Signed in, so hosting is reachable — no "please log in" toast. */}
                <Link href={localizedHref('/host')} className={navLink}>
                  {t('becomeHost')}
                </Link>
              </>
            )}
          </nav>

          {/* Right Side — signed-in treatment */}
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='hidden lg:flex rounded-[1.25rem] font-medium border-[#5B0F16] text-[#5B0F16] hover:bg-[#5B0F16] hover:text-[#F6F1E6]'
              asChild
            >
              <Link href={localizedHref('/host')}>{t('rent')}</Link>
            </Button>

            <LocaleSwitcher className='hidden lg:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-full border border-border' />

            <Link href='/reservations' className={utilityLink}>
              {t('trips')}
            </Link>
            <Link href='/saved' className={utilityLink}>
              {t('wishlists')}
            </Link>

            {/* Name + initial stands in for the old generic person icon. */}
            <Link
              href='/account'
              className='hidden sm:inline-flex items-center gap-2 rounded-full border border-[#5B0F16]/25 bg-white/60 px-3 py-2 text-sm font-semibold text-[#5B0F16] transition-colors hover:bg-white'
            >
              <span
                aria-hidden
                className='inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#5B0F16] text-xs font-bold text-[#F6F1E6]'
              >
                {viewer.firstName.charAt(0).toUpperCase()}
              </span>
              <span className='whitespace-nowrap'>
                {exploreT('nav.greeting', { name: viewer.firstName })}
              </span>
            </Link>

            {/* Route handler, not a page — must be a real navigation so the
                Set-Cookie that clears qk_token is applied. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href='/api/auth/logout'
              className='hidden lg:inline-flex text-sm font-medium text-[#6B6055] transition-colors hover:text-[#5B0F16]'
            >
              {t('logout')}
            </a>

            {/* Below lg the rest of the account nav collapses into the same
                slide-out menu the explore header uses. */}
            <div className='lg:hidden'>
              <MobileMenu firstName={viewer.firstName} isHost={viewer.isHost} />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale()
  const attributes = await getAttributes()
  const destinations = await getDestinations(locale)
  const viewer = await getViewer()

  const supabase = await createClient()
  const { data: siteSettings } = await supabase?.from('site_settings').select('navbar_config, footer_config, banners_config').eq('id', 1).single() || { data: null }

  return (
    <>
      {viewer ? (
        <SignedInHeader
          viewer={viewer}
          attributes={attributes}
          destinations={destinations}
          config={siteSettings?.navbar_config}
        />
      ) : (
        <Navbar
          attributes={attributes}
          destinations={destinations}
          config={siteSettings?.navbar_config}
        />
      )}
      <Suspense fallback={null}>
        <BannersStack banners={siteSettings?.banners_config || []} />
      </Suspense>
      <main className="flex-1">
        {children}
      </main>
      <Footer config={siteSettings?.footer_config} />
      <ChatWidget />
      <AuthModal />
    </>
  );
}
