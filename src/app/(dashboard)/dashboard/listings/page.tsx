import { getUser } from '@/lib/supabase/auth-actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CodeBadge } from '@/components/ui/code-badge'
import { Home, Plus, Eye, Pencil, MoreHorizontal, ChevronDown, CheckCircle2, XCircle, Globe, Ban } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ListingsSort } from './ListingsSort'
import { getTranslations } from 'next-intl/server'
import { getRequestLocale } from '@/i18n/request-locale'
import { localizePathname } from '@/lib/i18n/pathname'
import { ListingActions } from './ListingActions'


export const dynamic = 'force-dynamic'

interface HostListing
{
  id: string
  title: string
  location: string
  price_per_night: number
  currency: string
  images: string[]
  is_published: boolean
  created_at: string
  city?: string | null
  state?: string | null
  country: string
  listing_code?: string | null

  active_offer?: {
    start_date: string
    end_date: string
    status: string
  } | null

  active_booking_count: number
}

/**
 * Fetches listings owned by a specific host user
 * @param userId - The host's user ID
 * @param sort - Sort functionality
 * @returns Array of host's listings
 */
async function getHostListings(userId: string, sort: string = 'newest'): Promise<HostListing[]>
{
  const supabase = await createClient()

  // Return empty if Supabase not configured
  if (!supabase) {
    return []
  }

  let query = supabase
    .from('listings')
    .select(`
      id, 
      title, 
      location,
      city_ref:cities(name),
      state_ref:states(name),
      country_ref:countries(name),
      price_per_night, 
      currency,
      is_published, 
      created_at,
      listing_code,
      listing_images(url, order),
      listing_best_offers(start_date, end_date, status),
      bookings(status)
    `)
    .eq('user_id', userId)

  // Apply sorting
  switch (sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true })
      break
    case 'price_high':
      query = query.order('price_per_night', { ascending: false })
      break
    case 'price_low':
      query = query.order('price_per_night', { ascending: true })
      break
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false })
      break
  }

  query = query.order('order', { foreignTable: 'listing_images', ascending: true })

  // order by created_at desc for best offers to get the latest one provided we limit or filter in js
  // supabase joins don't support limit easily on inner relation without distinct, so we'll sort in JS or use Supabase order if possible.
  // We can order the inner relation:
  query = query.order('created_at', { foreignTable: 'listing_best_offers', ascending: false })


  const { data, error } = await query

  if (error) {
    console.error('Error fetching host listings:', error)
    return []
  }

  // Parse images, best offer, and active bookings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listings = (data || []).map((item: any) =>
  {
    // Get the most recent relevant offer
    const latestOffer = item.listing_best_offers?.[0] || null

    // Count active bookings (pending, confirmed, active, stalled)
    const activeBookingCount = (item.bookings || []).filter((b: any) => 
      ['pending', 'confirmed', 'active', 'stalled'].includes(b.status)
    ).length

    return {
      ...item,
      city: item.city_ref?.name || null,
      state: item.state_ref?.name || null,
      country: item.country_ref?.name || 'Egypt', // Fallback just in case
      images: item.listing_images
        ? item.listing_images.map((i: { url: string }) => i.url)
        : [],
      active_offer: latestOffer,
      active_booking_count: activeBookingCount
    }
  })

  return listings as HostListing[]
}


interface ListingsPageProps
{
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ListingsPage(props: ListingsPageProps)
{
  const searchParams = await props.searchParams
  const user = await getUser()
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'newest'
  const listings = user ? await getHostListings(user.id, sort) : []
  const t = await getTranslations('dashboardListings')
  const locale = await getRequestLocale()

  const getLocalizedUrl = (url: string) => localizePathname(url, locale)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <ListingsSort />
          <Link href={getLocalizedUrl('/dashboard/listings/create')}>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('addListing')}
            </Button>
          </Link>
        </div>
      </div>

      {listings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">{t('empty.title')}</CardTitle>
            <CardDescription className="text-center mb-4 max-w-md">
              {t('empty.description')}
            </CardDescription>
            <Link href={getLocalizedUrl('/dashboard/listings/create')}>
              <Button>
                <Plus className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('empty.button')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {listings.map((listing) =>
          {
            const latestOffer = listing.active_offer
            // If there is no record in the new table, treat as 'none' to allow new requests, ignoring potential desync in the listings table column
            const statusToDisplay = latestOffer ? latestOffer.status : 'none'
            const hasActiveOffer = !!latestOffer

            const offerStart = hasActiveOffer ? new Date(latestOffer!.start_date) : null
            const offerEnd = hasActiveOffer ? new Date(latestOffer!.end_date) : null

            return (
              <Card key={listing.id}>
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Image */}
                    <div className="relative w-full sm:w-40 h-40 shrink-0">
                      <Image
                        src={listing.images[0] || 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80'}
                        alt={listing.title}
                        fill
                        className="object-cover rounded-t-lg sm:rounded-s-lg sm:rounded-tr-none rtl:sm:rounded-e-lg rtl:sm:rounded-l-none"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold">{listing.title}</h3>
                            {listing.listing_code && (
                              <CodeBadge
                                code={listing.listing_code}
                                label={t('card.codeBadge')}
                                variant="outline"
                                className="font-mono text-xs"
                              />
                            )}
                            <Badge variant={listing.is_published ? 'default' : 'secondary'}>
                              {listing.is_published ? t('card.published') : t('card.draft')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{listing.city && `${listing.city}, `}{listing.state && `${listing.state}, `}{listing.country}</p>
                        </div>

                        <ListingActions
                          listingId={listing.id}
                          isPublished={listing.is_published}
                          activeBookingCount={listing.active_booking_count}
                          viewUrl={getLocalizedUrl(`/listings/${listing.id}`)}
                          manageUrl={getLocalizedUrl(`/dashboard/listings/${listing.id}/manage`)}
                        />

                      </div>

                      <div className="flex gap-2 mt-2">
                        {statusToDisplay === 'requested' && hasActiveOffer && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600 gap-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-yellow-600 animate-pulse" />
                            {t('card.offerRequested', { start: format(offerStart!, 'MMM d'), end: format(offerEnd!, 'MMM d') })}
                          </Badge>
                        )}
                        {statusToDisplay === 'approved' && hasActiveOffer && (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('card.offerActive', { start: format(offerStart!, 'MMM d'), end: format(offerEnd!, 'MMM d') })}
                          </Badge>
                        )}
                        {statusToDisplay === 'rejected' && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            {t('card.offerRejected')}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                          {t('card.listedOn', { date: new Date(listing.created_at).toLocaleDateString(locale, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }) })}
                        </div>
                        <div className="font-semibold">
                          {listing.price_per_night.toLocaleString(locale)} <span className="text-xs uppercase text-muted-foreground">{listing.currency || 'EGP'}</span>
                          <span className="text-muted-foreground font-normal"> {t('card.perNight')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
