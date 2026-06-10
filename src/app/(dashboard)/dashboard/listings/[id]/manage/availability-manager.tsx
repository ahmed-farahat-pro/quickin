'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Info, XCircle, Clock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format, eachDayOfInterval, parseISO, addDays, isBefore, isSameDay } from 'date-fns'
import { AvailabilityCalendar, type DayAvailability, type PriceAdjustment, type OfferDay, type BookedDay } from '@/components/features/host/availability-calendar'
import { requestBestOffer, cancelBestOffer } from '@/app/actions/best-offers'
import { updateAvailability } from '@/app/actions/calendar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useTranslations, useLocale } from 'next-intl'

interface BestOffer
{
  id: string
  start_date: string
  end_date: string
  status: 'requested' | 'approved'
  offer_price: number | null
}

interface Booking
{
  id: string
  check_in: string
  check_out: string
  status: 'confirmed' | 'pending' | 'active'
}

interface ListingAvailabilityManagerProps
{
  listingId: string
  basePrice: number
  currency: string
}

export function ListingAvailabilityManager({
  listingId,
  basePrice,
  currency
}: ListingAvailabilityManagerProps)
{
  const t = useTranslations('dashboardListingManage.availability')
  const locale = useLocale()
  const [serverAvailability, setServerAvailability] = useState<DayAvailability[]>([])
  const [localAvailability, setLocalAvailability] = useState<DayAvailability[]>([])
  const [priceAdjustments, setPriceAdjustments] = useState<PriceAdjustment[]>([])
  const [activeOffers, setActiveOffers] = useState<BestOffer[]>([])
  const [offerDays, setOfferDays] = useState<OfferDay[]>([])
  const [bookedDays, setBookedDays] = useState<BookedDay[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState<DayAvailability[]>([])

  // Convert offers to individual OfferDay entries
  const buildOfferDays = useCallback((offers: BestOffer[]): OfferDay[] =>
  {
    const days: OfferDay[] = []
    offers.forEach(offer =>
    {
      const start = parseISO(offer.start_date)
      const end = parseISO(offer.end_date)
      // Offer covers inclusive range usually? Assuming yes for "best offer" logic
      const interval = eachDayOfInterval({ start, end })
      interval.forEach(date =>
      {
        days.push({
          date: format(date, 'yyyy-MM-dd'),
          offerId: offer.id,
          status: offer.status,
          offerPrice: offer.offer_price
        })
      })
    })
    return days
  }, [])

  // Build BookedDay entries from bookings
  const buildBookedDays = useCallback((bookings: Booking[]): BookedDay[] =>
  {
    const days: BookedDay[] = []
    bookings.forEach(booking =>
    {
      const start = parseISO(booking.check_in)
      const end = parseISO(booking.check_out)

      if (start >= end) return

      // Booked nights: start -> end (exclusive of check-out day for stay, but maybe blocked for edit?)
      // Let's stick to standard: check-out day is NOT booked for the night.
      // So interval is [start, end - 1 day]
      const lastNight = addDays(end, -1)

      // If start == end, it's 0 nights (invalid), but if valid booking it has at least 1 night
      // If start > lastNight (e.g. 1 day booking), eachDayOfInterval handles [start, start] correctly
      const interval = eachDayOfInterval({ start, end: lastNight })

      interval.forEach(date =>
      {
        days.push({
          date: format(date, 'yyyy-MM-dd'),
          status: booking.status
        })
      })
    })
    return days
  }, [])

  // Fetch existing availability, price adjustments, offers, and bookings
  useEffect(() =>
  {
    const fetchData = async () =>
    {
      const supabase = createClient()

      // Fetch availability
      const { data: availData, error: availError } = await supabase
        .from('listing_availability')
        .select('date, is_available, price_override, note')
        .eq('listing_id', listingId)

      if (availError) {
        console.error('Error fetching availability:', availError)
        toast.error(t('messages.loadError'))
      } else if (availData) {
        const mapped: DayAvailability[] = availData.map(item => ({
          date: new Date(item.date),
          isAvailable: item.is_available,
          priceOverride: item.price_override,
          note: item.note
        }))
        setServerAvailability(mapped)
        setLocalAvailability(mapped)
      }

      // Fetch price adjustments
      const { data: adjData, error: adjError } = await supabase
        .from('listing_price_adjustments')
        .select('*')
        .eq('listing_id', listingId)
        .eq('is_active', true)

      if (adjError) {
        console.error('Error fetching adjustments:', adjError)
      } else if (adjData) {
        const mapped: PriceAdjustment[] = adjData.map(item => ({
          id: item.id,
          name: item.name,
          adjustmentType: item.adjustment_type as 'percentage' | 'fixed',
          adjustmentValue: parseFloat(item.adjustment_value),
          appliesToDays: item.applies_to_days || [],
          isActive: item.is_active
        }))
        setPriceAdjustments(mapped)
      }

      // Fetch active/pending best offers
      const { data: offersData, error: offersError } = await supabase
        .from('listing_best_offers')
        .select('id, start_date, end_date, status, offer_price')
        .eq('listing_id', listingId)
        .in('status', ['requested', 'approved'])
        .order('start_date', { ascending: true })

      if (offersError) {
        console.error('Error fetching offers:', offersError)
      } else if (offersData) {
        const offers = offersData as BestOffer[]
        setActiveOffers(offers)
        setOfferDays(buildOfferDays(offers))
      }

      // Fetch bookings (confirmed/pending)
      // We only care about future/recent bookings roughly? 
      // Fetching all might be okay for MVP, or filter >= today - some buffer
      const today = new Date()
      const queryStart = format(addDays(today, -30), 'yyyy-MM-dd') // Buffer in past

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, check_in, check_out, status')
        .eq('listing_id', listingId)
        .in('status', ['confirmed', 'pending', 'active'])
        .gte('check_out', queryStart) // Only bookings ending after last month

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError)
      } else if (bookingsData) {
        const bookings = bookingsData as Booking[]
        setBookedDays(buildBookedDays(bookings))
      }

      setIsLoading(false)
    }

    fetchData()
  }, [listingId, buildOfferDays, buildBookedDays, t])

  // Handle availability changes from the calendar
  const handleAvailabilityChange = useCallback((updates: DayAvailability[]) =>
  {
    // Merge updates into local availability
    setLocalAvailability(prev =>
    {
      const map = new Map(prev.map(d => [d.date.toISOString().split('T')[0], d]))
      updates.forEach(u =>
      {
        map.set(u.date.toISOString().split('T')[0], u)
      })
      return Array.from(map.values())
    })

    // Track pending changes for saving
    setPendingChanges(prev =>
    {
      const map = new Map(prev.map(d => [d.date.toISOString().split('T')[0], d]))
      updates.forEach(u =>
      {
        map.set(u.date.toISOString().split('T')[0], u)
      })
      return Array.from(map.values())
    })
  }, [])

  // Handle offer request from calendar
  const handleRequestOffer = useCallback(async (dates: string[], offerPrice: number) =>
  {
    if (dates.length === 0) return

    const sorted = [...dates].sort()
    const startDate = new Date(sorted[0])
    const endDate = new Date(sorted[sorted.length - 1])

    const result = await requestBestOffer(listingId, startDate, endDate, offerPrice)

    if (result.success) {
      toast.success(t('bestOffer.requestSuccess'))

      // Re-fetch offers
      const supabase = createClient()
      const { data: offersData } = await supabase
        .from('listing_best_offers')
        .select('id, start_date, end_date, status, offer_price')
        .eq('listing_id', listingId)
        .in('status', ['requested', 'approved'])
        .order('start_date', { ascending: true })

      if (offersData) {
        const offers = offersData as BestOffer[]
        setActiveOffers(offers)
        setOfferDays(buildOfferDays(offers))
      }
    } else {
      toast.error(result.error || t('bestOffer.requestError'))
    }
  }, [listingId, buildOfferDays, t])

  // Handle cancel offer
  const handleCancelOffer = useCallback(async (offerId: string) =>
  {
    setIsCancelling(offerId)
    const result = await cancelBestOffer(offerId)

    if (result.success) {
      toast.success(t('bestOffer.cancelSuccess'))
      // Remove from local state
      setActiveOffers(prev => prev.filter(o => o.id !== offerId))
      setOfferDays(prev => prev.filter(d => d.offerId !== offerId))
    } else {
      toast.error(result.error || t('bestOffer.cancelError'))
    }
    setIsCancelling(null)
  }, [t])

  // Discard changes - restore to server state
  const discardChanges = () =>
  {
    setLocalAvailability(serverAvailability)
    setPendingChanges([])
  }

  // Save changes to database
  const saveChanges = async () =>
  {
    if (pendingChanges.length === 0) {
      toast.info(t('messages.noChanges'))
      return
    }

    setIsSaving(true)

    try {
      // Use Server Action for secure update
      const result = await updateAvailability(listingId, pendingChanges)

      if (result.error) {
        throw new Error(result.error)
      }

      toast.success(t('messages.saveSuccess', { count: pendingChanges.length }))
      // Update server state to match local
      setServerAvailability(localAvailability)
      setPendingChanges([])
    } catch (error: any) {
      console.error('Error saving availability:', error)
      toast.error(error.message || t('messages.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Alert className="bg-blue-50/50 text-blue-900 border-blue-200 dark:bg-blue-950/20 dark:text-blue-200 dark:border-blue-900/50">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle>{t('bestOffer.noteTitle')}</AlertTitle>
        <AlertDescription>
          {t('bestOffer.noteDescription')}
        </AlertDescription>
      </Alert>

      {/* Active/Pending Offers Banner */}
      {activeOffers.length > 0 && (
        <div className="space-y-2">
          {activeOffers.map(offer => (
            <Alert key={offer.id} variant={offer.status === 'approved' ? 'default' : undefined} className="border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
              <Info className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="flex items-center gap-2">
                {t('bestOffer.bannerTitle')}
                <Badge variant={offer.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                  {offer.status === 'approved' ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> {t('bestOffer.approved')}</>
                  ) : (
                    <><Clock className="h-3 w-3 mr-1" /> {t('bestOffer.pending')}</>
                  )}
                </Badge>
              </AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">
                  {format(parseISO(offer.start_date), 'MMM d, yyyy')} — {format(parseISO(offer.end_date), 'MMM d, yyyy')}
                  {offer.offer_price && (
                    <span className="font-medium ml-1">• {offer.offer_price} {currency}/night</span>
                  )}
                  <span className="text-muted-foreground ml-1">
                    {t('bestOffer.lockedNote')}
                  </span>
                </span>
                {offer.status === 'requested' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive gap-1 shrink-0"
                    onClick={() => handleCancelOffer(offer.id)}
                    disabled={isCancelling === offer.id}
                  >
                    {isCancelling === offer.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {t('bestOffer.cancel')}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <AvailabilityCalendar
        basePrice={basePrice}
        currency={currency}
        availability={localAvailability}
        priceAdjustments={priceAdjustments}
        offerDays={offerDays}
        bookedDays={bookedDays}
        onAvailabilityChange={handleAvailabilityChange}
        onRequestOffer={handleRequestOffer}
      />

      {pendingChanges.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-sm">
            <span className="font-medium">{t('unsavedChanges', { count: pendingChanges.length })}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={discardChanges}
            >
              {t('discard')}
            </Button>
            <Button
              size="sm"
              onClick={saveChanges}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('saving')}
                </>
              ) : (
                t('save')
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
