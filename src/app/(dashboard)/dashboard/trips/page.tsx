import { getBookings } from '@/lib/supabase/bookings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, MapPin, Users, Clock, CheckCircle, History, XCircle, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { CodeBadge } from '@/components/ui/code-badge'
import { GuestBookingActions } from './guest-trip-actions'
import { getTranslations } from 'next-intl/server'
import { getRequestLocale } from '@/i18n/request-locale'
import { localizePathname } from '@/lib/i18n/pathname'
import { calculateRefund, type PolicySnapshot } from '@/lib/utils/refund-calculator'

export const dynamic = 'force-dynamic'

function getStatusBadge(status: string, t: any)
{
  switch (status) {
    case 'confirmed':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          <CheckCircle className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
          {t('status.confirmed')}
        </Badge>
      )
    case 'active':
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
          <CheckCircle className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
          {t('status.active')}
        </Badge>
      )
    case 'completed':
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
          <CheckCircle className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
          {t('status.completed')}
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
          {t('status.cancelled')}
        </Badge>
      )
    case 'rejected':
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-red-200">
          <XCircle className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
          {t('status.rejected')}
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
          {t('status.pending')}
        </Badge>
      )
  }
}

import { DashboardSearch } from '@/components/features/dashboard/dashboard-search'

// ... existing imports

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
})
{
  const { search } = await searchParams
  const bookings = await getBookings(search)
  const t = await getTranslations('dashboardTrips')
  const locale = await getRequestLocale()

  const getLocalizedUrl = (url: string) => localizePathname(url, locale)

  // Pending bookings awaiting host approval
  const pendingTrips = bookings.filter((b: { status: string }) =>
    b.status === 'pending'
  )

  // Upcoming confirmed trips (check-in in future OR ongoing)
  const upcomingTrips = bookings.filter((b: { check_in: string; check_out: string; status: string }) =>
    (b.status === 'confirmed' || b.status === 'active') && new Date(b.check_out) >= new Date()
  )

  // History: completed, cancelled, rejected, or past confirmed trips
  const historyTrips = bookings.filter((b: { check_in: string; check_out: string; status: string }) =>
    b.status === 'completed' ||
    b.status === 'cancelled' ||
    b.status === 'rejected' ||
    ((b.status === 'confirmed' || b.status === 'active') && new Date(b.check_out) < new Date())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="flex justify-between items-center">
        <DashboardSearch placeholder={t('searchPlaceholder')} />
      </div>

      <Tabs defaultValue={pendingTrips.length > 0 ? 'pending' : 'upcoming'} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            {t('tabs.pending')}
            {pendingTrips.length > 0 && (
              <Badge variant="secondary" className="ml-1 rtl:mr-1 rtl:ml-0">{pendingTrips.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {t('tabs.upcoming')}
            {upcomingTrips.length > 0 && (
              <Badge variant="secondary" className="ml-1 rtl:mr-1 rtl:ml-0">{upcomingTrips.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            {t('tabs.history')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingTrips.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="text-lg mb-2">{t('empty.pendingTitle')}</CardTitle>
                <CardDescription className="text-center mb-4">
                  {t('empty.pendingDesc')}
                </CardDescription>
                <Button asChild><Link href={getLocalizedUrl('/')}>{t('empty.browse')}</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingTrips.map((booking: TripBooking) => (
                <TripCard key={booking.id} booking={booking} isPending t={t} locale={locale} getLocalizedUrl={getLocalizedUrl} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingTrips.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="text-lg mb-2">{t('empty.upcomingTitle')}</CardTitle>
                <CardDescription className="text-center mb-4">{t('empty.upcomingDesc')}</CardDescription>
                <Button asChild><Link href={getLocalizedUrl('/')}>{t('empty.startSearching')}</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {upcomingTrips.map((booking: TripBooking) => (
                <TripCard key={booking.id} booking={booking} t={t} locale={locale} getLocalizedUrl={getLocalizedUrl} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {historyTrips.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="text-lg mb-2">{t('empty.historyTitle')}</CardTitle>
                <CardDescription className="text-center mb-4">
                  {t('empty.historyDesc')}
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {historyTrips.map((booking: TripBooking) => (
                <TripCard key={booking.id} booking={booking} isPast t={t} locale={locale} getLocalizedUrl={getLocalizedUrl} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface TripBooking
{
  id: string
  reservation_code: string | null
  check_in: string
  check_out: string
  guests: number
  subtotal: number
  total_with_fees: number
  status: string
  is_check_in_confirmed?: boolean
  message_count: number
  cancellation_policy_snapshot?: any
  listing: { id: string; title: string; location: string; images: string[] }
}

import { ChatDrawer } from '@/components/chat-drawer'
import { MessageSquare } from 'lucide-react'

function ChatButton({ bookingId, messageCount, label }: { bookingId: string, messageCount: number, label: string }) {
  return (
    <ChatDrawer 
      bookingId={bookingId} 
      trigger={
        <Button variant="outline" size="sm" className="gap-2 w-full mt-2 relative">
          <MessageSquare className="h-4 w-4" />
          {label}
          {messageCount > 0 && (
            <Badge 
              variant="secondary" 
              className="h-5 min-w-[20px] flex items-center justify-center p-1 text-[10px] rounded-full bg-primary text-primary-foreground border-none"
            >
              {messageCount}
            </Badge>
          )}
        </Button>
      } 
    />
  )
}

function TripCard({ booking, isPast, isPending, t, locale, getLocalizedUrl }: {
  booking: TripBooking
  isPast?: boolean
  isPending?: boolean
  t: any
  locale: string
  getLocalizedUrl: (url: string) => string
})
{
  const listing = Array.isArray(booking.listing) ? booking.listing[0] : booking.listing
  if (!listing) return null

  const nights = Math.ceil(
    (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24)
  )

  const showActions = isPending || (booking.status === 'confirmed' && !isPast)

  let refundText = undefined
  if (booking.status === 'confirmed' && booking.cancellation_policy_snapshot && !isPast) {
    const policySnapshot = booking.cancellation_policy_snapshot as PolicySnapshot
    const refundCalc = calculateRefund(booking.subtotal, booking.check_in, policySnapshot)
    if (refundCalc.refundAmount > 0) {
      refundText = `Est. Refund: ${refundCalc.refundAmount} EGP (${refundCalc.refundPercentage}% - ${policySnapshot.label || 'Flexible'})`
    } else {
      refundText = `No refund (${policySnapshot.label || 'Flexible'})`
    }
  }

  return (
    <Card className={isPast ? 'opacity-75' : ''}>
      <CardContent className="p-0 flex flex-col sm:flex-row">
        <div className="relative w-full sm:w-48 h-48 shrink-0">
          <Image
            src={listing.images?.[0] || 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80'}
            alt={listing.title}
            fill
            className="object-cover rounded-t-lg sm:rounded-s-lg sm:rounded-tr-none rtl:sm:rounded-e-lg rtl:sm:rounded-l-none"
          />
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className="font-semibold">{listing.title}</h3>
                {booking.reservation_code && (
                  <CodeBadge
                    code={booking.reservation_code}
                    label={t('card.resBadge')}
                    variant="secondary"
                    className="text-xs"
                  />
                )}
                {getStatusBadge(booking.status, t)}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
                <MapPin className="h-3 w-3" />{listing.location}
              </p>
              <div className="flex flex-wrap gap-4 text-sm mt-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(booking.check_in).toLocaleDateString(locale)} - {new Date(booking.check_out).toLocaleDateString(locale)}
                  <span className="text-muted-foreground">({t('card.nights', { count: nights })})</span>
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />{t('card.guests', { count: booking.guests })}
                </span>
              </div>
            </div>

            {/* Action buttons (Cancellation or Check-in Confirm) */}
            {showActions && (
              <div className="ml-4 rtl:mr-4 rtl:ml-0 flex flex-col items-end gap-2">
                <GuestBookingActions 
                  bookingId={booking.id} 
                  status={booking.status} 
                  isCheckInConfirmed={booking.is_check_in_confirmed}
                  refundText={refundText}
                  messageCount={booking.message_count}
                />
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <span className="font-semibold">{booking.total_with_fees.toLocaleString(locale)} EGP {t('card.total')}</span>
            <div className="flex gap-2">
              {isPast && (booking.status === 'completed' || ((booking.status === 'confirmed' || booking.status === 'active') && new Date(booking.check_out) < new Date())) && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={getLocalizedUrl(`/listings/${listing.id}#reviews`)}>
                    <Star className="h-4 w-4 mr-1 rtl:ml-1 rtl:mr-0" />
                    {t('card.rate')}
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link href={getLocalizedUrl(`/listings/${listing.id}`)}>{t('card.viewListing')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
