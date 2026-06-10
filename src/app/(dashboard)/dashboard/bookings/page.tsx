import { getUser } from '@/lib/supabase/auth-actions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, CheckCircle, XCircle, Users, Calendar, QrCode, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import { BookingActions } from './booking-actions'
import { getTranslations } from 'next-intl/server'
import { getRequestLocale } from '@/i18n/request-locale'
import { CodeBadge } from '@/components/ui/code-badge'
import { DashboardSearch } from '@/components/features/dashboard/dashboard-search'
import { BookingQrModal } from './booking-qr-modal'
import { ChatDrawer } from '@/components/chat-drawer'

export const dynamic = 'force-dynamic'

interface BookingRequest
{
  id: string
  reservation_code: string | null
  check_in: string
  check_out: string
  guests: number
  total_with_fees: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'rejected'
  created_at: string
  receipt_url: string | null
  escrow_status: string | null
  is_check_in_confirmed: boolean
  message_count: number
  listing: {
    id: string
    title: string
    listing_code: string | null
  }
  guest: {
    id: string
    name: string | null
    email: string | null
  }
}

async function getHostBookings(userId: string, searchQuery?: string): Promise<BookingRequest[]>
{
  const supabase = await createClient()
  if (!supabase) return []

  // Step 1: Get the host's listing IDs
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('id')
    .eq('user_id', userId)

  if (listingsError || !listings || listings.length === 0) {
    return []
  }

  const listingIds = listings.map(l => l.id)

  // Step 2: Get bookings for those listings
  let query = supabase
    .from('bookings')
    .select(`
      id,
      reservation_code,
      check_in,
      check_out,
      guests,
      subtotal,
      status,
      created_at,
      listing_id,
      user_id,
      receipt_url,
      escrow_status,
      is_check_in_confirmed,
      commission_rates:commission_rates(guest_rate),
      booking_messages(count)
    `)
    .in('listing_id', listingIds)
    .order('created_at', { ascending: false })

  if (searchQuery) {
    query = query.eq('reservation_code', searchQuery)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching host bookings:', error)
    return []
  }

  // Step 3: Fetch listing and guest details for each booking
  const bookings: BookingRequest[] = []

  for (const item of data || []) {
    // Get listing details
    const { data: listing } = await supabase
      .from('listings')
      .select('id, title, listing_code')
      .eq('id', item.listing_id)
      .single()

    // Get guest details
    const { data: guest } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', item.user_id)
      .single()

    // Compute total with fees from subtotal + guest fee
    const rates = Array.isArray((item as any).commission_rates) ? (item as any).commission_rates[0] : (item as any).commission_rates
    const guestRate = rates?.guest_rate ?? 0.02
    const guestFee = Math.round((item.subtotal || 0) * guestRate)

    const messagesCount = Array.isArray(item.booking_messages) 
      ? (item.booking_messages[0] as any)?.count || 0 
      : 0

    bookings.push({
      id: item.id,
      reservation_code: item.reservation_code,
      check_in: item.check_in,
      check_out: item.check_out,
      guests: item.guests,
      total_with_fees: (item.subtotal || 0) + guestFee,
      status: item.status,
      created_at: item.created_at,
      receipt_url: item.receipt_url,
      escrow_status: item.escrow_status,
      is_check_in_confirmed: item.is_check_in_confirmed || false,
      message_count: messagesCount,
      listing: {
        id: listing?.id || '',
        title: listing?.title || 'Unknown listing',
        listing_code: listing?.listing_code || null
      },
      guest: {
        id: guest?.id || '',
        name: guest?.full_name || 'Guest',
        email: guest?.email || ''
      }
    })
  }

  return bookings
}

function getStatusBadge(status: string, t: any)
{
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{t('status.pending')}</Badge>
    case 'confirmed':
      return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />{t('status.confirmed')}</Badge>
    case 'active':
      return <Badge variant="default" className="gap-1 bg-blue-500"><CheckCircle className="h-3 w-3" />In Check-in</Badge>
    case 'cancelled':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{t('status.cancelled')}</Badge>
    case 'rejected':
      return <Badge variant="destructive" className="gap-1 bg-red-700 hover:bg-red-800"><XCircle className="h-3 w-3" />{t('status.rejected')}</Badge>
    case 'completed':
      return <Badge variant="secondary" className="gap-1">{t('status.completed')}</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

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

function BookingCard({ booking, t }: { booking: BookingRequest, t: any })
{
  const checkIn = new Date(booking.check_in)
  const checkOut = new Date(booking.check_out)
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{booking.listing.title === 'Unknown listing' ? t('card.unknownListing') : booking.listing.title}</h3>
              {booking.reservation_code && (
                <CodeBadge
                  code={booking.reservation_code}
                  label={t('card.resBadge')}
                  variant="secondary"
                  className="text-xs"
                />
              )}
              {booking.listing.listing_code && (
                <CodeBadge
                  code={booking.listing.listing_code}
                  label={t('card.listBadge')}
                  variant="outline"
                  className="text-xs"
                />
              )}
              {getStatusBadge(booking.status, t)}
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(checkIn, 'MMM d')} - {format(checkOut, 'MMM d, yyyy')} ({t('card.nights', { count: nights })})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{t('card.guests', { count: booking.guests })}</span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-sm">
                <span className="text-muted-foreground">{t('card.guestLabel')}</span>{' '}
                <span className="font-medium">{booking.guest.name === 'Guest' ? t('card.guestFallback') : booking.guest.name}</span>
                {booking.guest.email && (
                  <span className="text-muted-foreground"> ({booking.guest.email})</span>
                )}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">{t('card.totalLabel')}</span>{' '}
                <span className="font-semibold">{booking.total_with_fees.toLocaleString()} EGP</span>
              </p>
            </div>
          </div>

          {booking.status === 'pending' && (
            <div className="flex flex-col items-end gap-2 text-right">
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                <Clock className="w-3 h-3 mr-1" />
                Processing Payment
              </Badge>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                The platform is currently holding the funds and verifying the guest's payment. Action required from admin.
              </p>
              <div className="mt-2 w-full">
                <ChatButton 
                  bookingId={booking.id} 
                  messageCount={booking.message_count} 
                  label={t('chatWithGuest')} 
                />
              </div>
            </div>
          )}

          {booking.status === 'confirmed' && (
            <div className="flex flex-col items-end gap-2 text-right">
              {booking.is_check_in_confirmed ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Check-in Confirmed
                </Badge>
              ) : (
                <>
                  <BookingQrModal
                    qrUrl={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent('quickin://confirm-checkin/' + booking.id)}`}
                    bookingId={booking.id}
                  />
                  <p className="text-xs text-muted-foreground max-w-[150px]">
                    Let the guest scan this QR code or confirm from their dashboard to release funds.
                  </p>
                </>
              )}
              <div className="mt-2 w-full">
                <ChatButton 
                  bookingId={booking.id} 
                  messageCount={booking.message_count} 
                  label={t('chatWithGuest')} 
                />
              </div>
            </div>
          )}

          {(booking.status as any) === 'active' && (
            <div className="flex flex-col items-end gap-2 text-right">
              <div className="mt-2 w-full">
                <ChatButton 
                  bookingId={booking.id} 
                  messageCount={booking.message_count} 
                  label={t('chatWithGuest')} 
                />
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          {t('card.requestedAt', { date: format(new Date(booking.created_at), 'MMM d, yyyy \'at\' h:mm a') })}
        </p>
      </CardContent>
    </Card>
  )
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
})
{
  const { search } = await searchParams
  const user = await getUser()
  const t = await getTranslations('dashboardBookings')

  if (!user) {
    redirect('/login')
  }

  const bookings = await getHostBookings(user.id, search)

  const pendingBookings = bookings.filter(b => b.status === 'pending')
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed')
  const pastBookings = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <div className="flex justify-between items-center">
        <DashboardSearch placeholder={t('searchPlaceholder')} />
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            {t('tabs.pending')}
            {pendingBookings.length > 0 && (
              <Badge variant="secondary" className="ml-1 rtl:mr-1 rtl:ml-0">{pendingBookings.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {t('tabs.confirmed')}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            {t('tabs.all')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingBookings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('empty.pending')}</p>
              </CardContent>
            </Card>
          ) : (
            pendingBookings.map(booking => (
              <BookingCard key={booking.id} booking={booking} t={t} />
            ))
          )}
        </TabsContent>

        <TabsContent value="confirmed" className="space-y-4">
          {confirmedBookings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('empty.confirmed')}</p>
              </CardContent>
            </Card>
          ) : (
            confirmedBookings.map(booking => (
              <BookingCard key={booking.id} booking={booking} t={t} />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {bookings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('empty.all')}</p>
              </CardContent>
            </Card>
          ) : (
            bookings.map(booking => (
              <BookingCard key={booking.id} booking={booking} t={t} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}


