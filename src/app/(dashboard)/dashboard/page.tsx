import { getUser } from '@/lib/supabase/auth-actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Home, Calendar, Heart, Settings, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getRequestLocale } from '@/i18n/request-locale'
import { localizePathname } from '@/lib/i18n/pathname'

export const dynamic = 'force-dynamic'

async function getStats(userId: string) {
  const supabase = await createClient()
  if (!supabase) return { listings: 0, trips: 0, wishlists: 0 }

  // Get listing count (if host)
  const { count: listingCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Get upcoming trips count
  const { count: tripCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('guest_id', userId)
    .gte('check_out', new Date().toISOString().split('T')[0])

  // Get wishlist count
  const { count: wishlistCount } = await supabase
    .from('wishlists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  return {
    listings: listingCount || 0,
    trips: tripCount || 0,
    wishlists: wishlistCount || 0
  }
}

export default async function DashboardPage() {
  const user = await getUser()
  const stats = user ? await getStats(user.id) : { listings: 0, trips: 0, wishlists: 0 }
  const t = await getTranslations('dashboardPage')
  const locale = await getRequestLocale()
  
  const getLocalizedUrl = (url: string) => localizePathname(url, locale)

  const quickLinks = [
    {
      title: t('links.myListings.title'),
      description: stats.listings > 0 ? t('links.myListings.activeCount', { count: stats.listings }) : t('links.myListings.description'),
      icon: Home,
      href: getLocalizedUrl('/dashboard/listings'),
      color: 'text-blue-500'
    },
    {
      title: t('links.myTrips.title'),
      description: stats.trips > 0 ? t('links.myTrips.upcomingCount', { count: stats.trips }) : t('links.myTrips.description'),
      icon: Calendar,
      href: getLocalizedUrl('/dashboard/trips'),
      color: 'text-green-500'
    },
    {
      title: t('links.wishlists.title'),
      description: stats.wishlists > 0 ? t('links.wishlists.savedCount', { count: stats.wishlists }) : t('links.wishlists.description'),
      icon: Heart,
      href: getLocalizedUrl('/dashboard/wishlists'),
      color: 'text-rose-500'
    },
    {
      title: t('links.accountSettings.title'),
      description: t('links.accountSettings.description'),
      icon: Settings,
      href: getLocalizedUrl('/dashboard/profile'),
      color: 'text-slate-500'
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('welcome')}
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <link.icon className={`h-5 w-5 ${link.color}`} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base">{link.title}</CardTitle>
                <CardDescription className="text-sm">
                  {link.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Host CTA - only show if no listings */}
      {stats.listings === 0 && (
        <Card className="bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/20 dark:to-orange-950/20 border-none">
          <CardHeader>
            <CardTitle>{t('hostCta.title')}</CardTitle>
            <CardDescription>
              {t('hostCta.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={getLocalizedUrl('/dashboard/listings/create')}>
                <Home className="mr-2 rtl:ml-2 rtl:mr-0 h-4 w-4" />
                {t('hostCta.button')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

