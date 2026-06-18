'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import
{
  Star,
  Share,
  Heart,
  MapPin,
  Wifi,
  Car,
  Tv,
  Wind,
  Utensils,
  Waves,
  Loader2,
  CalendarDays
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { ListingSubNav } from './listing-sub-nav'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format, isBefore, isSameDay, eachDayOfInterval, addDays } from 'date-fns'
import { toast } from 'sonner'
import { useUIStore } from '@/stores/ui-store'
import type { ListingWithHost, ReviewWithUser } from '@/types'
import type { User } from '@supabase/supabase-js'
import { cn, parsePostGISHex } from "@/lib/utils"
import { createBooking } from '@/lib/supabase/bookings'
import { getListingWishlistStatus } from '@/lib/supabase/wishlists'
import { getCalculatedPrice } from '@/lib/actions/price-actions'
import { WishlistModal } from '@/components/features/wishlists/wishlist-modal'
import { createClient } from '@/lib/supabase/client'
import { ReviewList } from '@/components/features/reviews/review-list'
import { ReviewForm } from '@/components/features/reviews/review-form'
import { ReviewStats } from '@/components/features/reviews/review-stats'
import { ListingGallery } from './listing-gallery'
import { ListingAmenitiesClient, ListingAttributeDisplay } from './listing-amenities-client'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'
import { formatDate, formatNumber } from '@/lib/i18n/format'
import { MIN_REVIEWS_THRESHOLD } from '@/lib/constants'

// Dynamically import Map to avoid SSR issues
const ListingMap = dynamic(() => import('./listing-map'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-muted animate-pulse rounded-xl" />
})

interface ListingDetailProps
{
  listing: ListingWithHost
  reviews?: ReviewWithUser[]
  currentUser?: User | null
  isFavorite?: boolean
  canReview?: boolean
  blockedDates?: Date[]
  bookedDates?: Date[]
  priceAdjustments?: {
    customPriceDates: Date[]
    weekendAdjustedDates: Date[]
    dateRangeAdjustedDates: Date[]
  }
  customPriceDates?: Date[]
  existingBookingStatus?: string | null
  amenitiesData?: {
    highlighted: ListingAttributeDisplay[]
    byCategory: Record<string, ListingAttributeDisplay[]>
    categoryLabels: Record<string, string>
  }
  offerDays?: Date[]
  bestOfferPrice?: number | null
  displayPrice?: number | null
  guestCommissionRate?: number
  commentsCount?: number
  commentsNode?: React.ReactNode
}

export function ListingDetail({
  listing,
  reviews = [],
  currentUser = null,
  isFavorite: initialFavorite = false,
  canReview = false,
  blockedDates = [],
  bookedDates = [],
  priceAdjustments = { customPriceDates: [], weekendAdjustedDates: [], dateRangeAdjustedDates: [] },
  customPriceDates = [],
  existingBookingStatus = null,
  amenitiesData,
  offerDays = [],
  bestOfferPrice = null,
  displayPrice = null,
  guestCommissionRate = 0.02,
  commentsCount = 0,
  commentsNode
}: ListingDetailProps)
{
  const locale = useLocale() as Locale
  const t = useTranslations('listingDetail')
  const tCommon = useTranslations('common')
  const tComments = useTranslations('comments')
  const { openAuthModal } = useUIStore()
  const [checkIn, setCheckIn] = useState<Date | undefined>()
  const [checkOut, setCheckOut] = useState<Date | undefined>()
  const [guests, setGuests] = useState(1)
  const [isFavorite, setIsFavorite] = useState(initialFavorite)

  // Sync state with prop if it changes via router.refresh()
  useEffect(() =>
  {
    setIsFavorite(initialFavorite)
  }, [initialFavorite])

  const [isPending, startTransition] = useTransition()
  const [isNavigating, setIsNavigating] = useState(false)
  const isBooking = isPending || isNavigating
  const [isSaving, startSaving] = useTransition()
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculatedSubtotal, setCalculatedSubtotal] = useState<number | null>(null)
  const [priceBreakdown, setPriceBreakdown] = useState<{ date: string; price: number; adjustmentName?: string }[]>([])
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [activeField, setActiveField] = useState<'checkIn' | 'checkOut'>('checkIn')
  const [numberOfMonths, setNumberOfMonths] = useState(1)
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false)
  const supabase = createClient()

  useEffect(() =>
  {
    const handleResize = () =>
    {
      setNumberOfMonths(window.innerWidth >= 768 ? 2 : 1)
    }
    // Initial check
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const nights = checkIn && checkOut
    ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // Calculate actual price with adjustments when dates change
  useEffect(() =>
  {
    if (checkIn && checkOut && nights > 0) {
      setIsCalculating(true)
      const checkInStr = format(checkIn, 'yyyy-MM-dd')
      const checkOutStr = format(checkOut, 'yyyy-MM-dd')

      getCalculatedPrice(listing.id, listing.price_per_night, checkInStr, checkOutStr)
        .then((result) =>
        {
          setCalculatedSubtotal(result.subtotal)
          setPriceBreakdown(result.pricePerNight || [])
        })
        .catch(() =>
        {
          // Fallback to simple calculation
          setCalculatedSubtotal(nights * listing.price_per_night)
          setPriceBreakdown([])
        })
        .finally(() =>
        {
          setIsCalculating(false)
        })
    } else {
      setCalculatedSubtotal(null)
      setPriceBreakdown([])
    }
  }, [checkIn, checkOut, nights, listing.id, listing.price_per_night])

  // Use calculated subtotal if available, otherwise fallback
  const subtotal = calculatedSubtotal ?? (nights * listing.price_per_night)
  const serviceFee = Math.round(subtotal * guestCommissionRate)
  const total = subtotal + serviceFee

  const host = listing.host

  // Automatic adjustment dates (weekend/date range - violet)
  const adjustedDates = [
    ...priceAdjustments.weekendAdjustedDates,
    ...priceAdjustments.dateRangeAdjustedDates
  ]

  // Helper to check if date has adjustment
  const hasAdjustment = (date: Date) =>
  {
    return adjustedDates.some(adj => adj.toDateString() === date.toDateString())
  }

  // All unavailable dates (blocked + booked) combined for range validation
  const unavailableDates = [...blockedDates, ...bookedDates]

  // Check if a date range [from, to) contains any unavailable dates
  const rangeContainsUnavailable = useCallback((from: Date, to: Date): boolean =>
  {
    if (!isBefore(from, to)) return false
    // Check each day in [from, to) — the last night is to - 1 day
    const lastNight = addDays(to, -1)
    const days = eachDayOfInterval({ start: from, end: lastNight })
    return days.some(day =>
      unavailableDates.some(ud => ud.toDateString() === day.toDateString())
    )
  }, [unavailableDates])

  // Try to set a complete range, rejecting if it spans unavailable dates
  const trySetRange = useCallback((from: Date, to: Date) =>
  {
    // Ensure from < to
    let start = from
    let end = to
    if (!isBefore(start, end)) {
      start = to
      end = from
    }

    if (rangeContainsUnavailable(start, end)) {
      toast.error(t('errors.rangeIncludesUnavailable'))
      // Keep check-in, clear check-out so user can pick a valid end
      setCheckIn(start)
      setCheckOut(undefined)
      setActiveField('checkOut')
      return
    }

    setCheckIn(start)
    setCheckOut(end)
  }, [rangeContainsUnavailable, t])

  // Unified date selection handler for range calendar
  // We use the second argument `selectedDay` to detect clicks on already selected dates for toggling
  const handleDateSelect = useCallback((range: { from?: Date; to?: Date } | undefined, selectedDay: Date) =>
  {
    // Explicit toggle logic: if user clicks a date that is currently selected as start or end, clear it.
    if (selectedDay) {
      if (checkIn && isSameDay(selectedDay, checkIn)) {
        setCheckIn(undefined)
        // If start is cleared, and we had an end date, it might be confusing to keep end without start.
        // For simplicity and clarity, we'll clear the end date too if it was set, forcing a fresh start.
        if (checkOut) {
          setCheckOut(undefined)
        }
        setActiveField('checkIn')
        return
      }
      if (checkOut && isSameDay(selectedDay, checkOut)) {
        setCheckOut(undefined)
        setActiveField('checkOut')
        return
      }
    }

    if (!range) {
      // Calendar cleared by internal logic
      setCheckIn(undefined)
      setCheckOut(undefined)
      return
    }

    const from = range.from
    const to = range.to

    if (activeField === 'checkIn') {
      if (from) {
        // Auto-correct: if new check-in is on or after check-out, swap
        if (checkOut && !isBefore(from, checkOut)) {
          trySetRange(checkOut, from)
        } else {
          setCheckIn(from)
          // If we already have a checkout, validate the new range
          if (checkOut) {
            if (rangeContainsUnavailable(from, checkOut)) {
              toast.error(t('errors.rangeIncludesUnavailable'))
              setCheckOut(undefined)
            }
          }
        }
        // Advance to check-out field
        setActiveField('checkOut')
      }
    } else {
      // checkOut field active
      if (to) {
        // Both from and to provided by calendar
        trySetRange(from!, to)
      } else if (from && !to) {
        // Only from selected, user clicked a single date for check-out
        if (checkIn && !isBefore(checkIn, from)) {
          // New date is before check-in → swap
          trySetRange(from, checkIn)
        } else if (checkIn) {
          trySetRange(checkIn, from)
        } else {
          setCheckOut(from)
        }
      }
    }
  }, [activeField, checkIn, checkOut, trySetRange, rangeContainsUnavailable, t])

  const handleReserve = () =>
  {
    if (isBooking) return // Prevent multiple clicks

    if (!checkIn || !checkOut) {
      toast.error(t('errors.selectDates'))
      return
    }

    if (checkIn >= checkOut) {
      toast.error(t('errors.invalidDateOrder'))
      return
    }

    if (!currentUser) {
      toast.error(t('errors.loginToBook'), {
        action: { label: t('actions.logIn'), onClick: () => openAuthModal('login') }
      })
      return
    }

    if (currentUser.id === listing.user_id) {
      toast.error(t('errors.cannotBookOwnListing'))
      return
    }

    // Use transition to show loading state during redirect
    setIsNavigating(true)
    startTransition(() =>
    {
      // Redirect to booking confirmation page
      const params = new URLSearchParams({
        checkIn: format(checkIn, 'yyyy-MM-dd'),
        checkOut: format(checkOut, 'yyyy-MM-dd'),
        guests: guests.toString()
      })

      // Force a hard navigation to prevent state flicker during hydration/transition
      window.location.href = `${localizePathname(`/listings/${listing.id}/book`, locale)}?${params.toString()}`
      // The issue with transition is it might finish if the browser navigates "too fast" or "too slow" 
      // relative to React's lifecycle. 
    })
  }

  const handleSave = async () =>
  {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error(t('errors.loginToSaveWishlist'), {
        action: { label: t('actions.logIn'), onClick: () => openAuthModal('login') }
      })
      return
    }

    setIsWishlistModalOpen(true)
  }

  const userReview = currentUser ? reviews.find(r => r.user_id === currentUser.id) : undefined

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">{listing.title}</h1>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-current" />
            <span className="font-medium">
              {reviews.length > MIN_REVIEWS_THRESHOLD ? (listing.rating?.toFixed(2) || t('rating.new')) : t('rating.new')}
            </span>
            <span className="text-muted-foreground">
              · {formatNumber(reviews.length, locale)} {reviews.length === 1 ? t('reviews.one') : t('reviews.many')}
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{t('locationFormat', { city: listing.city || listing.location, country: listing.country })}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="sm" className="gap-2">
              <Share className="h-4 w-4" />
              {t('actions.share')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
              {isFavorite ? t('actions.saved') : t('actions.save')}
            </Button>
          </div>
        </div>
        {listing.is_guest_favorite && (
          <div className="mx-auto flex items-center gap-2 py-3 px-4 bg-muted/40 rounded-xl border border-muted-foreground/10 animate-in fade-in slide-in-from-left-2 duration-500 max-w-fit">
            <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
              <Heart className="h-4 w-4 fill-primary" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">{t('guestFavorite.title')}</span>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{t('guestFavorite.subtitle')}</p>
            </div>
          </div>
        )}
      </div>

      <ListingSubNav />

      {/* Image Gallery */}
      <div id="photos">
        <ListingGallery
          title={listing.title}
          images={listing.images}
          listingImages={listing.listing_images}
        />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Host Info (Overview) */}
          <div id="overview" className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {t('hostedBy', {
                  host: listing.is_staff_hosted
                    ? t('brandName')
                    : host?.full_name
                      ? (() => {
                          const firstName = host.full_name.split(' ')[0]
                          const pascal = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
                          return pascal.length > 12 ? pascal.slice(0, 12) + '...' : pascal
                        })()
                      : t('hostFallback')
                })}
              </h2>              <div className="flex flex-col gap-1 mt-1">
                <p className="text-muted-foreground font-medium">
                  {listing.property_type?.name || t('propertyTypeFallback')}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t('units.guestCount', { count: listing.max_guests })}
                  {listing.property_type?.type !== 'service' && (
                    <>
                      {' '}
                      · {t('units.bedroomCount', { count: listing.bedrooms })}
                      {' '}
                      · {t('units.bedCount', { count: listing.beds })}
                      {' '}
                      · {t('units.bathCount', { count: listing.bathrooms })}
                    </>
                  )}
                </p>
                {listing.listing_lifestyles && listing.listing_lifestyles.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {listing.listing_lifestyles.map(tag => (
                      <Badge key={tag.lifestyle_category.id} variant="secondary" className="px-2 py-0.5 text-xs font-normal">
                        {tag.lifestyle_category.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {listing.is_staff_hosted ? (
              <div className="h-14 flex items-center justify-center bg-muted/30 rounded-xl px-3 border border-muted-foreground/10 overflow-hidden min-w-[80px]">
                <img
                  src="/logo.png"
                  alt={t('brandName')}
                  className="h-10 w-auto object-contain"
                />
              </div>
            ) : (
              <a href={localizePathname(`/hosts/${listing.user_id}`, locale)} className="flex-shrink-0">
                <Avatar className="h-14 w-14 border hover:ring-2 hover:ring-primary transition-shadow">
                  <AvatarImage src={host?.avatar_url || undefined} alt={host?.full_name || t('hostFallback')} />
                  <AvatarFallback className="bg-muted">{(host?.full_name || 'H')[0]}</AvatarFallback>
                </Avatar>
              </a>
            )}
          </div>
          {!listing.is_staff_hosted && listing.user_id && (
            <a
              href={localizePathname(`/hosts/${listing.user_id}`, locale)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mt-1"
            >
              {t('host.viewProfile')} →
            </a>
          )}

          <Separator />

          {/* Description */}
          <div id="about">
            <h3 className="text-lg font-semibold mb-4">{t('sections.aboutPlace')}</h3>
            <p className="text-muted-foreground whitespace-pre-line">
              {listing.description || t('fallbacks.description')}
            </p>
          </div>

          <Separator />

          {/* Amenities */}
          <div id="amenities">
            {amenitiesData && (amenitiesData.highlighted.length > 0 || Object.keys(amenitiesData.byCategory).length > 0) ? (
              <ListingAmenitiesClient
                highlighted={amenitiesData.highlighted}
                byCategory={amenitiesData.byCategory}
                categoryLabels={amenitiesData.categoryLabels}
              />
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('sections.whatPlaceOffers')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{t('fallbacks.noAmenities')}</span>
                  </div>
                </div>
              </>
            )}

          </div>

          <Separator />

          {/* Map */}
          <div id="location">
            <h3 className="text-lg font-semibold mb-4">{t('sections.whereYoullBe')}</h3>
            <ListingMap
              center={(() =>
              {
                if (listing.lat && listing.lng) return [listing.lat, listing.lng] as [number, number]

                if (listing.location_geo) {
                  // Try WKT (POINT(lng lat))
                  if (listing.location_geo.startsWith('POINT')) {
                    const matches = listing.location_geo.match(/POINT\(([^ ]+) ([^ ]+)\)/)
                    if (matches && matches.length === 3) {
                      return [parseFloat(matches[2]), parseFloat(matches[1])] as [number, number]
                    }
                  }
                  // Try WKB Hex
                  const coords = parsePostGISHex(listing.location_geo)
                  if (coords) return [coords.lat, coords.lng] as [number, number]
                }
                return [51.505, -0.09]
              })()}
              location={listing.location}
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {t('locationFormat', { city: listing.city || listing.location, country: listing.country })}
            </p>
          </div>

          <Separator />

          {/* Reviews & Comments Tabs */}
          <Tabs defaultValue="reviews" className="w-full" id="reviews">
            <TabsList className="grid w-full grid-cols-2 mb-6 h-auto p-1 bg-muted/30">
              <TabsTrigger 
                value="reviews" 
                className="py-2.5 px-2 text-xs sm:text-sm truncate"
              >
                {t('reviews.count', { count: reviews.length })}
              </TabsTrigger>
              <TabsTrigger 
                value="comments" 
                className="py-2.5 px-2 text-xs sm:text-sm truncate"
              >
                {tComments('tabLabel')} {commentsCount > 0 ? `(${commentsCount})` : ''}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="reviews" className="mt-0">
              <div id="reviews">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <Star className="h-5 w-5 fill-current" />
                    {t('rating.new')} · {t('reviews.count', { count: reviews.length })}
                  </h3>
                  {currentUser && (
                    <div className="ms-auto">
                      <ReviewForm
                        listingId={listing.id}
                        user={currentUser}
                        disabled={!canReview && !userReview}
                        existingReview={userReview}
                      />
                    </div>
                  )}
                </div>

                <ReviewStats reviews={reviews} />
                <ReviewList reviews={reviews} />
              </div>
            </TabsContent>
            
            <TabsContent value="comments" className="mt-0 pt-2 border-t border-dashed">
              {commentsNode}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Booking Widget */}
        <div className="lg:col-span-1" id="book">
          <Card className="sticky top-24">
            <CardContent className="p-6">
              {(() =>
              {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const isOfferToday = offerDays.some(d => d.toDateString() === today.toDateString())
                const isAdjustedToday = adjustedDates.some(d => d.toDateString() === today.toDateString())
                const isCustomToday = customPriceDates.some(d => d.toDateString() === today.toDateString())

                // displayPrice = today's calculated price (base + adjustments, NO offer discount)
                // bestOfferPrice = offer discount price (lower, if active today)
                // If today is an offer day: show bestOfferPrice prominently, displayPrice as strikethrough
                // Otherwise: show displayPrice (or base) as the main price
                const calculatedToday = displayPrice ?? listing.price_per_night
                const todayPrice = isOfferToday && bestOfferPrice != null
                  ? bestOfferPrice
                  : calculatedToday
                const strikethroughPrice = isOfferToday && bestOfferPrice != null && bestOfferPrice < calculatedToday
                  ? calculatedToday               // Show calculated price struck-through
                  : (calculatedToday < listing.price_per_night ? listing.price_per_night : null)  // Show base if adjusted up
                const isDiscounted = strikethroughPrice != null

                // Color from calendar legend
                const priceColor = isOfferToday
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isAdjustedToday
                    ? 'text-violet-600 dark:text-violet-400'
                    : isCustomToday
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground'

                return (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-2xl font-semibold ${priceColor}`}>
                          {listing.currency} {formatNumber(todayPrice, locale)}
                        </span>
                        <span className="text-muted-foreground text-lg">{tCommon('night')}</span>
                      </div>
                      {isDiscounted && (
                        <span className="text-sm text-muted-foreground line-through">
                          {listing.currency} {formatNumber(strikethroughPrice!, locale)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Date Selection — Single Calendar Popover */}
              <div className="border rounded-xl mb-4">
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <div className="grid grid-cols-2">
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className={`h-14 rounded-none rounded-tl-xl border-r border-b justify-start px-4 ${activeField === 'checkIn' && calendarOpen ? 'bg-muted' : ''}`}
                        onClick={() => { setActiveField('checkIn'); setCalendarOpen(true) }}
                      >
                        <div className="text-left">
                          <p className="text-xs font-semibold uppercase">{t('booking.checkIn')}</p>
                          <p className={`text-sm ${checkIn ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {checkIn ? formatDate(checkIn, locale, { month: 'short', day: 'numeric', year: 'numeric' }) : t('booking.addDate')}
                          </p>
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className={`h-14 rounded-none rounded-tr-xl border-b justify-start px-4 ${activeField === 'checkOut' && calendarOpen ? 'bg-muted' : ''}`}
                        onClick={() => { setActiveField('checkOut'); setCalendarOpen(true) }}
                      >
                        <div className="text-left">
                          <p className="text-xs font-semibold uppercase">{t('booking.checkOut')}</p>
                          <p className={`text-sm ${checkOut ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {checkOut ? formatDate(checkOut, locale, { month: 'short', day: 'numeric', year: 'numeric' }) : t('booking.addDate')}
                          </p>
                        </div>
                      </Button>
                    </PopoverTrigger>
                  </div>

                  <PopoverContent className="w-auto p-0 rounded-2xl bg-white/30 backdrop-blur-sm" align="end" side="bottom" sideOffset={4}>
                    {/* Active field indicator */}
                    <div className="flex border-b">
                      <button
                        className={`flex-1 py-2 text-xs font-semibold text-center transition-colors ${activeField === 'checkIn' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setActiveField('checkIn')}
                      >
                        <CalendarDays className="h-3.5 w-3.5 inline mr-1" />
                        {t('booking.checkIn')} {checkIn && <span className="font-normal ml-1">({formatDate(checkIn, locale, { month: 'short', day: 'numeric' })})</span>}
                      </button>
                      <button
                        className={`flex-1 py-2 text-xs font-semibold text-center transition-colors ${activeField === 'checkOut' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setActiveField('checkOut')}
                      >
                        <CalendarDays className="h-3.5 w-3.5 inline mr-1" />
                        {t('booking.checkOut')} {checkOut && <span className="font-normal ml-1">({formatDate(checkOut, locale, { month: 'short', day: 'numeric' })})</span>}
                      </button>
                    </div>

                    <Calendar
                      mode="range"
                      className="rounded-b-2xl border bg-accent/70 backdrop-blur-sm"
                      selected={checkIn || checkOut ? { from: checkIn, to: checkOut } : undefined}
                      onSelect={(range, selectedDay) => handleDateSelect(range, selectedDay)}
                      numberOfMonths={numberOfMonths}
                      disabled={(date) =>
                      {
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        if (date < today) return true
                        // Check blocked dates
                        if (blockedDates.some(blocked => blocked.toDateString() === date.toDateString())) return true
                        // Check booked dates
                        if (bookedDates.some(booked => booked.toDateString() === date.toDateString())) return true

                        return false
                      }}
                      modifiers={{
                        blocked: blockedDates,
                        booked: bookedDates,
                        adjusted: adjustedDates,
                        customPrice: customPriceDates,
                        offerDay: offerDays
                      }}
                      modifiersClassNames={{
                        blocked: 'bg-red-100 text-red-400 line-through dark:bg-red-900/30',
                        booked: 'bg-neutral-100 text-neutral-400 line-through dark:bg-neutral-800 dark:text-neutral-500 cursor-not-allowed',
                        adjusted: 'bg-violet-100 dark:bg-violet-900/30',
                        customPrice: 'ring-2 ring-inset ring-amber-400 dark:ring-amber-500',
                        offerDay: '!bg-emerald-500 !text-white hover:!bg-emerald-600 focus:!bg-emerald-600 !font-medium !ring-0'
                      }}
                    />

                    {/* Clear dates */}
                    {(checkIn || checkOut) && (
                      <div className="px-3 pb-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() =>
                          {
                            setCheckIn(undefined)
                            setCheckOut(undefined)
                            setActiveField('checkIn')
                          }}
                        >
                          {t('booking.clearDates')}
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                <div className="h-14 w-full rounded-b-xl flex items-center justify-start px-4 hover:bg-muted/50 transition-colors">
                  <div className="text-left flex items-center gap-2 w-full">
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase">{tCommon('guests')}</p>
                      <p className="text-sm text-muted-foreground">{formatNumber(guests, locale)} {guests === 1 ? tCommon('guest') : tCommon('guests')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setGuests(Math.max(1, guests - 1))}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center">{guests}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setGuests(Math.min(listing.max_guests, guests + 1))}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {existingBookingStatus !== null ? (
                <div className="text-center p-4 bg-muted rounded-lg">
                  {existingBookingStatus === 'active' ? (
                    <>
                      <p className="font-medium text-muted-foreground">{t('booking.activeBookingTitle')}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('booking.activeBookingPrefix')}{' '}
                        <a href={localizePathname('/dashboard/trips', locale)} className="underline text-primary">{t('booking.tripsLink')}</a>{' '}
                        {t('booking.activeBookingSuffix')}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-muted-foreground">{t('booking.existingBookingTitle')}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('booking.existingBookingPrefix')}{' '}
                        <a href={localizePathname('/dashboard/trips', locale)} className="underline text-primary">{t('booking.tripsLink')}</a>{' '}
                        {t('booking.existingBookingSuffix')}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <Button
                  className="w-full h-12 text-base"
                  size="lg"
                  onClick={handleReserve}
                  disabled={isBooking}
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tCommon('loading')}
                    </>
                  ) : nights > 0 ? t('actions.requestToBook') : t('actions.checkAvailability')}
                </Button>
              )}

              {nights > 0 && existingBookingStatus === null && (
                <>
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    {t('booking.notChargedYet')}
                  </p>

                  <div className="mt-6 space-y-3">
                    {/* Detailed per-night breakdown - grouped for 15+ nights */}
                    {priceBreakdown.length > 0 ? (
                      <PriceBreakdownDisplay
                        priceBreakdown={priceBreakdown}
                        nights={nights}
                        currency={listing.currency}
                        locale={locale}
                        subtotal={subtotal}
                      />
                    ) : (
                      <div className="flex justify-between">
                        <span className="underline">
                          {listing.currency} {formatNumber(listing.price_per_night, locale)} × {formatNumber(nights, locale)} {nights === 1 ? tCommon('night') : tCommon('nights')}
                        </span>
                        <span>{listing.currency} {formatNumber(subtotal, locale)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="underline">{t('booking.serviceFee')}</span>
                      <span>{listing.currency} {formatNumber(serviceFee, locale)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>{t('booking.total')}</span>
                      <span>{listing.currency} {formatNumber(total, locale)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Color Legend */}
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('calendarLegend.title')}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 relative overflow-hidden">
                      <div className="absolute inset-0 bg-neutral-400/20 transform -rotate-45 scale-150 origin-center translate-y-1"></div>
                    </div>
                    <span>{t('calendarLegend.booked')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30" />
                    <span>{t('calendarLegend.blocked')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-violet-100 dark:bg-violet-900/30" />
                    <span>{t('calendarLegend.adjusted')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded ring-2 ring-inset ring-amber-400" />
                    <span>{t('calendarLegend.custom')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span>{t('calendarLegend.bestOffer')}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <WishlistModal
        isOpen={isWishlistModalOpen}
        onOpenChange={setIsWishlistModalOpen}
        listingId={listing.id}
        listingTitle={listing.title}
        onStatusChange={setIsFavorite}
      />
    </div >
  )
}

// Price Breakdown Display Component - Groups prices for 15+ nights
interface PriceBreakdownProps
{
  priceBreakdown: { date: string; price: number; adjustmentName?: string }[]
  nights: number
  currency: string
  locale: Locale
  subtotal: number
}

function PriceBreakdownDisplay({ priceBreakdown, nights, currency, locale, subtotal }: PriceBreakdownProps)
{
  const t = useTranslations('listingDetail')
  const tCommon = useTranslations('common')
  const [showAll, setShowAll] = useState(false)
  const COLLAPSE_THRESHOLD = 15
  const BASE_RATE_LABEL = 'Base rate'
  const BEST_OFFER_LABEL = 'Best Offer'

  // Group prices by rate type for summary
  const groupedPrices = priceBreakdown.reduce((acc, night) =>
  {
    const key = night.adjustmentName || BASE_RATE_LABEL
    if (!acc[key]) {
      acc[key] = { count: 0, total: 0, pricePerNight: night.price }
    }
    acc[key].count++
    acc[key].total += night.price
    return acc
  }, {} as Record<string, { count: number; total: number; pricePerNight: number }>)

  // If <= 15 nights, show full breakdown
  // Helper to get color class based on adjustment type
  const getAdjustmentColor = (adjustmentName?: string) =>
  {
    if (!adjustmentName) return ''
    if (adjustmentName === BEST_OFFER_LABEL) return 'text-emerald-600 dark:text-emerald-400'
    return 'text-violet-600 dark:text-violet-400'
  }

  const getAdjustmentLabel = (adjustmentName?: string) =>
  {
    if (!adjustmentName) return ''
    if (adjustmentName === BASE_RATE_LABEL) return t('priceBreakdown.baseRate')
    if (adjustmentName === BEST_OFFER_LABEL) return t('calendarLegend.bestOffer')
    return adjustmentName
  }

  if (nights <= COLLAPSE_THRESHOLD) {
    return (
      <div className="space-y-1">
        {priceBreakdown.map((night) => (
          <div key={night.date} className="flex justify-between text-sm">
            <span className={getAdjustmentColor(night.adjustmentName)}>
              {formatDate(night.date, locale, { weekday: 'short', month: 'short', day: 'numeric' })}
              {night.adjustmentName && (
                <span className="text-xs ml-1">({getAdjustmentLabel(night.adjustmentName)})</span>
              )}
            </span>
            <span className={`${getAdjustmentColor(night.adjustmentName)} ${night.adjustmentName ? 'font-medium' : ''}`}>
              {currency} {formatNumber(night.price, locale)}
            </span>
          </div>
        ))}
        <div className="flex justify-between pt-2 border-t">
          <span className="font-medium">{t('priceBreakdown.subtotal')} ({formatNumber(nights, locale)} {nights === 1 ? tCommon('night') : tCommon('nights')})</span>
          <span className="font-medium">{currency} {formatNumber(subtotal, locale)}</span>
        </div>
      </div>
    )
  }

  // For > 15 nights, show grouped summary with expandable detail
  return (
    <div className="space-y-2">
      {/* Grouped summary */}
      {Object.entries(groupedPrices).map(([rateType, data]) => (
        <div key={rateType} className="flex justify-between text-sm">
          <span className={getAdjustmentColor(rateType === BASE_RATE_LABEL ? undefined : rateType)}>
            {currency} {formatNumber(data.pricePerNight, locale)} × {formatNumber(data.count, locale)} {data.count === 1 ? tCommon('night') : tCommon('nights')}
            {rateType !== BASE_RATE_LABEL && (
              <span className="text-xs ml-1">({getAdjustmentLabel(rateType)})</span>
            )}
          </span>
          <span className={`${getAdjustmentColor(rateType === BASE_RATE_LABEL ? undefined : rateType)} ${rateType !== BASE_RATE_LABEL ? 'font-medium' : ''}`}>
            {currency} {formatNumber(data.total, locale)}
          </span>
        </div>
      ))}

      <div className="flex justify-between pt-2 border-t">
        <span className="font-medium">{t('priceBreakdown.subtotal')} ({formatNumber(nights, locale)} {nights === 1 ? tCommon('night') : tCommon('nights')})</span>
        <span className="font-medium">{currency} {formatNumber(subtotal, locale)}</span>
      </div>

      {/* Expandable full breakdown */}
      <button
        onClick={() => setShowAll(!showAll)}
        className="text-xs text-primary hover:underline w-full text-left"
      >
        {showAll ? `▼ ${t('priceBreakdown.hideNightlyBreakdown')}` : `▶ ${t('priceBreakdown.viewAllNights')}`}
      </button>

      {showAll && (
        <div className="space-y-1 pl-2 border-l-2 border-muted max-h-64 overflow-y-auto">
          {priceBreakdown.map((night) => (
            <div key={night.date} className="flex justify-between text-xs text-muted-foreground">
              <span className={night.adjustmentName === BEST_OFFER_LABEL ? 'text-emerald-500' : night.adjustmentName ? 'text-violet-500' : ''}>
                {formatDate(night.date, locale, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className={night.adjustmentName === BEST_OFFER_LABEL ? 'text-emerald-500' : ''}>{currency} {formatNumber(night.price, locale)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
