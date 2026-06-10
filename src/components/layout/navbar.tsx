// =============================================================================
// NAVBAR COMPONENT
// =============================================================================
// Description: Main navigation header with QuickIn logo, search bar, and user menu
// Features:
//   - QuickIn logo linking to homepage
//   - Search bar (desktop only)
//   - User dropdown with auth-aware menu items
//   - Glass effect on scroll
// =============================================================================

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Menu, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuSeparator,
DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SearchBar } from '@/components/features/search/search-bar'
import { useUIStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { FilterableAttribute, SearchDestination } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { localizeHrefWithQuery } from '@/lib/i18n/pathname'
import type { Locale } from '@/i18n/config'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'
import { UserNotificationBell } from '@/components/notifications/user-notification-bell'
import type { NavbarConfig } from '@/types/site-settings'

interface NavbarProps {
  attributes?: FilterableAttribute[]
  destinations?: SearchDestination[]
  config?: NavbarConfig
}

export function Navbar({ attributes, destinations, config }: NavbarProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('nav')
  const commonT = useTranslations('common')
  const { openAuthModal } = useUIStore()
  const [isScrolled, setIsScrolled] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [hasListings, setHasListings] = useState(false)

  const supabase = createClient()

  // Check auth state on mount and listen for changes
  useEffect(() => {
    if (!supabase) { setIsLoading(false); return }
    // Get initial session
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setIsLoading(false)
    }
    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  // Check listings count when user changes
  useEffect(() => {
    const checkListings = async () => {
      if (!user || !supabase) {
        setHasListings(false)
        return
      }
      const { count } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setHasListings((count || 0) > 0)
    }

    checkListings()
  }, [user, supabase])

  // Add scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  /**
   * Handle user logout
   * Signs out from Supabase and refreshes the page
   */
  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut()
    window.location.reload()
  }

  const isAuthenticated = !!user
  const localizedHref = (href: string) => localizeHrefWithQuery(href, locale)

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 bg-[#F6F1E6] border-b border-[#E2D8C8]`}
    >
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
                  target={link.is_external ? "_blank" : undefined}
                  rel={link.is_external ? "noopener noreferrer" : undefined}
                  className='text-muted-foreground hover:text-foreground transition-colors'
                >
                  {link.label[locale as 'en' | 'ar'] || link.label.en}
                </Link>
              ))
            ) : (
              <>
                <Link
                  href={localizedHref('/')}
                  className='text-muted-foreground hover:text-foreground transition-colors'
                >
                  {t('anywhere')}
                </Link>
                <Link
                  href={localizedHref('/listings')}
                  className='text-muted-foreground hover:text-foreground transition-colors'
                >
                  {t('listings')}
                </Link>
                <Link
                  href={localizedHref('/services')}
                  className='text-muted-foreground hover:text-foreground transition-colors'
                >
                  {t('servicesManagement')}
                </Link>
                {isAuthenticated ? (
                  <Link
                    href='/dashboard/listings'
                    className='text-muted-foreground hover:text-foreground transition-colors'
                  >
                    {t('becomeHost')}
                  </Link>
                ) : (
                  <button
                    onClick={() => toast.error(t('pleaseLoginFirst'), {
                      action: { label: t('login'), onClick: () => openAuthModal('login') }
                    })}
                    className='text-muted-foreground hover:text-foreground transition-colors'
                  >
                    {t('becomeHost')}
                  </button>
                )}
              </>
            )}
          </nav>

          {/* Right Side */}
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='hidden lg:flex rounded-[1.25rem] font-medium border-[#5B0F16] text-[#5B0F16] hover:bg-[#5B0F16] hover:text-[#F6F1E6]'
              asChild
            >
              <Link href='/dashboard/listings'>
                {t('rent')}
              </Link>
            </Button>

            <LocaleSwitcher className='hidden lg:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-full border border-border' />

            {isAuthenticated && <UserNotificationBell />}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  className='flex items-center gap-2 rounded-full border border-border px-3 py-6 hover:shadow-md transition-shadow'
                >
                  <Menu className='h-4 w-4' />
                  {isAuthenticated && user ? (
                    <Avatar className='h-7 w-7'>
                      <AvatarImage src={user.user_metadata?.avatar_url} />
                      <AvatarFallback className='text-xs bg-primary text-primary-foreground'>
                        {(user.email || 'U')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className='bg-muted rounded-full p-1'>
                      <User className='h-5 w-5 text-muted-foreground' />
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-56 rounded-xl'>
                {isLoading ? (
                  <DropdownMenuItem disabled>{commonT('loading')}</DropdownMenuItem>
                ) : isAuthenticated ? (
                  <>
                    {/* User info */}
                    <div className='px-2 py-1.5 text-sm'>
                      <p className='font-medium'>{user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('userFallback')}</p>
                      <p className='text-muted-foreground text-xs'>{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    {/* Guest */}
                    <DropdownMenuItem asChild>
                      <Link href='/dashboard'>{t('dashboard')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href='/dashboard/trips'>{t('trips')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href='/dashboard/wishlists'>{t('wishlists')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* Host */}
                    <DropdownMenuItem asChild>
                      <Link href='/dashboard/listings'>{t('manageListings')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href='/dashboard/bookings'>{t('bookings')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* Account */}
                    <DropdownMenuItem asChild>
                      <Link href='/dashboard/profile'>{t('account')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={localizedHref('/help')}>{t('helpCenter')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      {t('logout')}
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={() => openAuthModal('signup')}
                      className='font-medium'
                    >
                      {t('signup')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openAuthModal('login')}>
                      {t('login')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => toast.error(t('pleaseLoginFirst'), {
                        action: { label: t('login'), onClick: () => openAuthModal('login') }
                      })}
                    >
                      {t('hostYourHome')}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={localizedHref('/help')}>{t('helpCenter')}</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
