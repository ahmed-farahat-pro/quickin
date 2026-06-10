'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { format, differenceInDays, eachDayOfInterval, addDays } from 'date-fns'
import { Minus, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUIStore } from '@/stores/ui-store'
import type { DateRange } from 'react-day-picker'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'
import { formatDate, formatNumber } from '@/lib/i18n/format'

interface BookingWidgetProps {
  listingId: string
  basePrice: number
  currency: string
  minNights: number
  maxGuests: number
  blockedDates?: Date[]
  className?: string
}

export function BookingWidget({
  listingId,
  basePrice,
  currency,
  minNights = 1,
  maxGuests = 10,
  blockedDates = [],
  className
}: BookingWidgetProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('bookingWidget')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { openAuthModal } = useUIStore()
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [guests, setGuests] = useState(1)
  const [isCheckingAuth, setIsCheckingAuth] = useState(false)

  // Calculate number of nights
  const nights = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0
    return differenceInDays(dateRange.to, dateRange.from)
  }, [dateRange])

  // Calculate total price
  const totalPrice = useMemo(() => {
    return nights * basePrice
  }, [nights, basePrice])

  // Service fee (example: 10%)
  const serviceFee = useMemo(() => {
    return Math.round(totalPrice * 0.1)
  }, [totalPrice])

  // Check if dates overlap with blocked dates
  const hasBlockedDates = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return false
    const selectedDays = eachDayOfInterval({ start: dateRange.from, end: addDays(dateRange.to, -1) })
    return selectedDays.some(day => 
      blockedDates.some(blocked => 
        format(day, 'yyyy-MM-dd') === format(blocked, 'yyyy-MM-dd')
      )
    )
  }, [dateRange, blockedDates])

  // Disable dates that are blocked or in the past
  const disabledDays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return [
      { before: today },
      ...blockedDates
    ]
  }, [blockedDates])

  // Handle guest count changes
  const incrementGuests = () => {
    if (guests < maxGuests) setGuests(guests + 1)
  }

  const decrementGuests = () => {
    if (guests > 1) setGuests(guests - 1)
  }

  // Handle booking submission
  const handleReserve = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error(t('errors.selectDates'))
      return
    }

    if (nights < minNights) {
      toast.error(
        t('errors.minStay', {
          count: formatNumber(minNights, locale),
          unit: minNights === 1 ? tCommon('night') : tCommon('nights'),
        }),
      )
      return
    }

    if (hasBlockedDates) {
      toast.error(t('errors.selectedDatesUnavailable'))
      return
    }

    setIsCheckingAuth(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error(t('errors.loginToBook'), {
        action: { label: t('actions.logIn'), onClick: () => openAuthModal('login') }
      })
      setIsCheckingAuth(false)
      return
    }

    // Navigate to booking confirmation page with params
    const params = new URLSearchParams({
      checkIn: format(dateRange.from, 'yyyy-MM-dd'),
      checkOut: format(dateRange.to, 'yyyy-MM-dd'),
      guests: guests.toString()
    })

    router.push(`${localizePathname(`/listings/${listingId}/book`, locale)}?${params.toString()}`)
    setIsCheckingAuth(false)
  }

  const canReserve = dateRange?.from && dateRange?.to && nights >= minNights && !hasBlockedDates

  return (
    <Card className={cn('sticky top-24', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-semibold">{formatNumber(basePrice, locale)}</span>
            <span className="text-muted-foreground"> {currency}</span>
            <span className="text-muted-foreground text-sm"> / {tCommon('night')}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date Selection */}
        <div className="grid grid-cols-2 gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'justify-start text-left font-normal h-14 flex-col items-start',
                  !dateRange?.from && 'text-muted-foreground'
                )}
              >
                <span className="text-[10px] uppercase tracking-wider font-semibold">{t('fields.checkIn')}</span>
                <span className="text-sm">
                  {dateRange?.from ? formatDate(dateRange.from, locale, { month: 'short', day: 'numeric', year: 'numeric' }) : t('fields.addDate')}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                disabled={disabledDays}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'justify-start text-left font-normal h-14 flex-col items-start',
                  !dateRange?.to && 'text-muted-foreground'
                )}
              >
                <span className="text-[10px] uppercase tracking-wider font-semibold">{t('fields.checkOut')}</span>
                <span className="text-sm">
                  {dateRange?.to ? formatDate(dateRange.to, locale, { month: 'short', day: 'numeric', year: 'numeric' }) : t('fields.addDate')}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                disabled={disabledDays}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Guests Selection */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold">{t('fields.guests')}</p>
              <p className="text-sm">{formatNumber(guests, locale)} {guests === 1 ? tCommon('guest') : tCommon('guests')}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={decrementGuests}
                disabled={guests <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center font-medium">{guests}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={incrementGuests}
                disabled={guests >= maxGuests}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Minimum nights notice */}
        {minNights > 1 && (
          <p className="text-xs text-muted-foreground">
            {t('messages.minStayNotice', {
              count: formatNumber(minNights, locale),
              unit: minNights === 1 ? tCommon('night') : tCommon('nights'),
            })}
          </p>
        )}

        {/* Reserve Button */}
        <Button 
          className="w-full h-12 text-base"
          onClick={handleReserve}
          disabled={!canReserve || isCheckingAuth}
        >
          {isCheckingAuth ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t('actions.checking')}
            </>
          ) : (
            t('actions.requestToBook')
          )}
        </Button>

        {!canReserve && dateRange?.from && dateRange?.to && (
          <p className="text-xs text-destructive text-center">
            {hasBlockedDates 
              ? t('messages.selectedDatesUnavailable')
              : t('errors.minStay', {
                count: formatNumber(minNights, locale),
                unit: minNights === 1 ? tCommon('night') : tCommon('nights'),
              })
            }
          </p>
        )}

        <p className="text-xs text-center text-muted-foreground">
          {t('messages.notChargedYet')}
        </p>
      </CardContent>

      {/* Price Breakdown */}
      {nights > 0 && (
        <CardFooter className="flex-col gap-2 pt-0">
          <Separator />
          <div className="w-full space-y-2 pt-2">
            <div className="flex justify-between text-sm">
              <span className="underline">
                {formatNumber(basePrice, locale)} {currency} × {formatNumber(nights, locale)} {nights === 1 ? tCommon('night') : tCommon('nights')}
              </span>
              <span>{formatNumber(totalPrice, locale)} {currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="underline">{t('pricing.serviceFee')}</span>
              <span>{formatNumber(serviceFee, locale)} {currency}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold pt-2">
              <span>{t('pricing.total')}</span>
              <span>{formatNumber(totalPrice + serviceFee, locale)} {currency}</span>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
