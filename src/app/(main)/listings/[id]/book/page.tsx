import { getUser } from '@/lib/supabase/auth-actions'
import { createClient } from '@/lib/supabase/server'
import { calculateBookingPrice } from '@/lib/supabase/queries'
import { validateDateRange } from '@/lib/supabase/bookings'
import { getCommissionRates } from '@/lib/actions/platform-settings'
import { notFound, redirect } from 'next/navigation'
import { differenceInDays, parseISO } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Calendar, Users, MapPin } from 'lucide-react'
import Image from 'next/image'
import { BookingConfirmForm } from './booking-confirm-form'
import { BookPagePriceBreakdown } from './book-page-price-breakdown'
import { VerificationGate, type VerificationStatus } from '@/components/features/verification'
import { getRequestLocale } from '@/i18n/request-locale'
import { getMessages } from '@/i18n/messages'
import { localizePathname } from '@/lib/i18n/pathname'
import { formatDate, formatNumber } from '@/lib/i18n/format'

export const dynamic = 'force-dynamic'

interface BookPageProps
{
  params: Promise<{ id: string }>
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>
}

async function getListing(listingId: string)
{
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      location,
      price_per_night,
      currency,
      min_nights,
      max_guests,
      listing_code,
      user_id,
      cancellation_policy,
      listing_images(url, order)
    `)
    .eq('id', listingId)
    .single()

  if (error) {
    console.error('Error fetching listing for booking:', error)
    return null
  }

  // Get first image
  const images = data.listing_images
    ? data.listing_images.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)).map((i: any) => i.url)
    : []

  return {
    ...data,
    images
  }
}

async function getUserVerificationStatus(userId: string): Promise<VerificationStatus>
{
  const supabase = await createClient()
  if (!supabase) return 'unverified'

  // Check if user is staff/admin first
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', userId)
    .eq('is_active', true)
    .single()

  if (staffProfile) {
    return 'verified'
  }

  const { data } = await supabase
    .from('profiles')
    .select('verification_status:verification_statuses(code)')
    .eq('id', userId)
    .single()

  const statusCode = (data?.verification_status as any)?.code
  return (statusCode as VerificationStatus) || 'unverified'
}

async function getUserAvailableBalance(userId: string): Promise<number> {
  const supabase = await createClient()
  if (!supabase) return 0
  const { data } = await supabase
    .rpc('get_user_balance', { p_user_id: userId })
    .single()
  return (data as any)?.available_balance || 0
}

async function getMobileWallets() {
  const supabase = await createClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('mobile_wallets')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  return data || []
}

export default async function BookPage({ params, searchParams }: BookPageProps)
{
  const locale = await getRequestLocale()
  const m = getMessages(locale)
  const t = m.bookingPage
  const common = m.common

  const { id } = await params
  const { checkIn, checkOut, guests } = await searchParams
  const user = await getUser()

  if (!user) {
    const nextPath = localizePathname(
      `/listings/${id}/book?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`,
      locale,
    )
    redirect(`${localizePathname('/login', locale)}?redirect=${encodeURIComponent(nextPath)}`)
  }

  if (!checkIn || !checkOut) {
    redirect(localizePathname(`/listings/${id}`, locale))
  }

  const listing = await getListing(id)

  if (!listing) {
    notFound()
  }

  // Prevent host from booking their own listing
  if (listing.user_id === user.id) {
    redirect(localizePathname(`/listings/${id}`, locale))
  }

  const checkInDate = parseISO(checkIn)
  const checkOutDate = parseISO(checkOut)
  const guestsCount = parseInt(guests || '1', 10)
  const nights = differenceInDays(checkOutDate, checkInDate)

  // Server-side date sanity checks
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate || checkInDate < today) {
    redirect(localizePathname(`/listings/${id}`, locale))
  }

  if (nights < (listing.min_nights || 1)) {
    redirect(localizePathname(`/listings/${id}`, locale))
  }

  // Server-side guest count validation
  if (guestsCount < 1 || guestsCount > (listing.max_guests || 1)) {
    redirect(localizePathname(`/listings/${id}`, locale))
  }

  // Server-side availability validation (blocked dates + overlapping bookings)
  // The RPC uses SECURITY DEFINER to see all bookings regardless of RLS.
  const supabase = await createClient()
  if (supabase) {
    const availabilityError = await validateDateRange(supabase, id, checkIn, checkOut)
    if (availabilityError) {
      redirect(localizePathname(`/listings/${id}`, locale))
    }
  }

  // Calculate price with adjustments
  const priceData = await calculateBookingPrice(
    listing.id,
    listing.price_per_night,
    checkIn,
    checkOut
  )

  const rates = await getCommissionRates()
  const subtotal = priceData.subtotal
  const serviceFee = Math.round(subtotal * rates.guestRate)
  const total = subtotal + serviceFee

  // Get user verification status
  const verificationStatus = await getUserVerificationStatus(user.id)
  
  // Get user balance
  const availableBalance = await getUserAvailableBalance(user.id)
  
  // Get active mobile wallets
  const mobileWallets = await getMobileWallets()

  const firstPhoto = listing.images?.[0] || '/placeholder-listing.jpg'

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">{t.title}</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Column - Booking Details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.yourTrip}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{t.dates}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(checkInDate, locale, { month: 'short', day: 'numeric' })} - {formatDate(checkOutDate, locale, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(nights, locale)} {nights === 1 ? common.night : common.nights}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{t.guests}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(guestsCount, locale)} {guestsCount === 1 ? common.guest : common.guests}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <VerificationGate status={verificationStatus} action="book" variant="inline">
            <BookingConfirmForm
              listingId={listing.id}
              checkIn={checkIn}
              checkOut={checkOut}
              guests={guestsCount}
              totalPrice={total}
              availableBalance={availableBalance}
              cancellationPolicyCode={listing.cancellation_policy ?? null}
              mobileWallets={mobileWallets}
            />
          </VerificationGate>
        </div>

        {/* Right Column - Listing Summary */}
        <div>
          <Card className="sticky top-24">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="relative h-24 w-24 rounded-lg overflow-hidden shrink-0">
                  <Image
                    src={firstPhoto}
                    alt={listing.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{listing.title}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{listing.location}</span>
                  </div>
                  {listing.listing_code && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.listingCode}: #{listing.listing_code}
                    </p>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <h4 className="font-medium">{t.priceDetails}</h4>

                {/* Grouped price breakdown */}
                <BookPagePriceBreakdown
                  pricePerNight={priceData.pricePerNight}
                  nights={nights}
                  currency={listing.currency}
                  subtotal={subtotal}
                  basePrice={listing.price_per_night}
                />

                <div className="flex justify-between text-sm">
                  <span>{t.serviceFee}</span>
                  <span>{formatNumber(serviceFee, locale)} {listing.currency}</span>
                </div>

                <Separator />

                <div className="flex justify-between font-semibold">
                  <span>{t.total} ({listing.currency})</span>
                  <span>{formatNumber(total, locale)} {listing.currency}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
