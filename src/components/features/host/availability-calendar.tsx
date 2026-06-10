'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isToday, isBefore } from 'date-fns'
import { ChevronLeft, ChevronRight, X, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { MAX_OFFER_DAYS } from '@/lib/constants'
import { useTranslations } from 'next-intl'

export interface DayAvailability
{
  date: Date
  isAvailable: boolean
  priceOverride: number | null
  note: string | null
}

export interface PriceAdjustment
{
  id: string
  name: string
  adjustmentType: 'percentage' | 'fixed'
  adjustmentValue: number
  appliesToDays: string[]
  isActive: boolean
}

export interface OfferDay
{
  date: string // yyyy-MM-dd
  offerId: string
  status: 'requested' | 'approved'
  offerPrice?: number | null
}

export interface BookedDay
{
  date: string // yyyy-MM-dd
  status: 'confirmed' | 'pending' | 'active'
}

interface AvailabilityCalendarProps
{
  listingId?: string
  basePrice: number
  currency?: string
  availability: DayAvailability[]
  priceAdjustments?: PriceAdjustment[]
  offerDays?: OfferDay[]
  bookedDays?: BookedDay[]
  onAvailabilityChange: (updates: DayAvailability[]) => void
  onRequestOffer?: (dates: string[], offerPrice: number) => void
  readOnly?: boolean
  className?: string
}

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function AvailabilityCalendar({
  basePrice,
  currency = 'EGP',
  availability,
  priceAdjustments = [],
  offerDays = [],
  bookedDays = [],
  onAvailabilityChange,
  onRequestOffer,
  readOnly = false,
  className
}: AvailabilityCalendarProps)
{
  const t = useTranslations('dashboardListingManage.availability')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionAnchor, setSelectionAnchor] = useState<Date | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [offerPriceInput, setOfferPriceInput] = useState('')
  const [showOfferPricePopover, setShowOfferPricePopover] = useState(false)
  const [showPricePopover, setShowPricePopover] = useState(false)

  // For drag selection
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Date | null>(null)
  const [dragEnd, setDragEnd] = useState<Date | null>(null)

  // Touch tracking
  const touchStartPos = useRef<{ x: number, y: number } | null>(null)
  const touchStartDate = useRef<Date | null>(null)
  const hasDragged = useRef(false)

  // Get days in current month view
  const monthDays = useMemo(() =>
  {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  // Create availability map for quick lookup
  const availabilityMap = useMemo(() =>
  {
    const map = new Map<string, DayAvailability>()
    availability.forEach(day =>
    {
      map.set(format(day.date, 'yyyy-MM-dd'), day)
    })
    return map
  }, [availability])

  // Create offer days map for quick lookup
  const offerDaysMap = useMemo(() =>
  {
    const map = new Map<string, OfferDay>()
    offerDays.forEach(day =>
    {
      map.set(day.date, day)
    })
    return map
  }, [offerDays])

  // Create booked days map for quick lookup
  const bookedDaysMap = useMemo(() =>
  {
    const map = new Map<string, BookedDay>()
    bookedDays.forEach(day =>
    {
      map.set(day.date, day)
    })
    return map
  }, [bookedDays])

  // Calculate price for a specific date (base + adjustments)
  const calculatePrice = useCallback((date: Date): number =>
  {
    const dayKey = format(date, 'yyyy-MM-dd')
    const dayData = availabilityMap.get(dayKey)

    if (dayData?.priceOverride !== null && dayData?.priceOverride !== undefined) {
      return dayData.priceOverride
    }

    let price = basePrice
    const dayName = WEEKDAY_NAMES[date.getDay()]

    priceAdjustments
      .filter(adj => adj.isActive && adj.appliesToDays?.includes(dayName))
      .forEach(adj =>
      {
        if (adj.adjustmentType === 'percentage') {
          price = price * (1 + adj.adjustmentValue / 100)
        } else {
          price = price + adj.adjustmentValue
        }
      })

    return Math.round(price * 100) / 100
  }, [basePrice, priceAdjustments, availabilityMap])

  // Get availability for a specific date
  const getDayAvailability = useCallback((date: Date): DayAvailability =>
  {
    const key = format(date, 'yyyy-MM-dd')
    return availabilityMap.get(key) || {
      date,
      isAvailable: true,
      priceOverride: null,
      note: null
    }
  }, [availabilityMap])

  // Check if a date is an offer day (locked)
  const isOfferDay = useCallback((date: Date): boolean =>
  {
    return offerDaysMap.has(format(date, 'yyyy-MM-dd'))
  }, [offerDaysMap])

  // Check if a date is blocked due to booking
  const isBookedDay = useCallback((date: Date): boolean =>
  {
    return bookedDaysMap.has(format(date, 'yyyy-MM-dd'))
  }, [bookedDaysMap])

  // Check if a date is valid for selection
  const isValidDate = useCallback((date: Date): boolean =>
  {
    if (readOnly) return false
    if (isBefore(date, new Date()) && !isToday(date)) return false
    // Offer days and booked days are locked
    if (isOfferDay(date) || isBookedDay(date)) return false
    return true
  }, [readOnly, isOfferDay, isBookedDay])

  // Get days in drag range
  const getDragRange = useCallback((): string[] =>
  {
    if (!dragStart || !dragEnd) return []
    const start = dragStart < dragEnd ? dragStart : dragEnd
    const end = dragStart < dragEnd ? dragEnd : dragStart
    return eachDayOfInterval({ start, end })
      .filter(d => isValidDate(d))
      .map(d => format(d, 'yyyy-MM-dd'))
  }, [dragStart, dragEnd, isValidDate])

  // Toggle a single date in selection
  const toggleDate = (date: Date) =>
  {
    const dateKey = format(date, 'yyyy-MM-dd')
    if (selectedDates.has(dateKey) && selectedDates.size === 1) {
      // Deselect if only this date is selected
      cancelSelection()
    } else {
      // Select just this date
      setSelectedDates(new Set([dateKey]))
      setSelectionAnchor(date)
      setIsSelecting(true)
    }
  }

  // Handle click with keyboard modifiers (desktop)
  const handleDayClick = (date: Date, e: React.MouseEvent) =>
  {
    if (!isValidDate(date)) return

    const dateKey = format(date, 'yyyy-MM-dd')

    if (e.shiftKey && selectionAnchor) {
      // Shift+Click: Select range from anchor to clicked date
      e.preventDefault()
      const start = selectionAnchor < date ? selectionAnchor : date
      const end = selectionAnchor < date ? date : selectionAnchor
      const rangeDates = eachDayOfInterval({ start, end })
        .filter(d => isValidDate(d))
        .map(d => format(d, 'yyyy-MM-dd'))

      setSelectedDates(new Set(rangeDates))
      setIsSelecting(true)
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+Click: Toggle individual date in selection
      e.preventDefault()
      const newSelection = new Set(selectedDates)
      if (newSelection.has(dateKey)) {
        newSelection.delete(dateKey)
      } else {
        newSelection.add(dateKey)
      }
      setSelectedDates(newSelection)
      setSelectionAnchor(date)
      setIsSelecting(newSelection.size > 0)
    }
    // Regular clicks are handled by mouseup after no drag
  }

  // Mouse drag handlers (desktop)
  const handleMouseDown = (date: Date, e: React.MouseEvent) =>
  {
    if (!isValidDate(date) || e.button !== 0) return
    // Don't start drag if using modifiers
    if (e.shiftKey || e.ctrlKey || e.metaKey) return

    setIsDragging(true)
    setDragStart(date)
    setDragEnd(date)
    hasDragged.current = false
  }

  const handleMouseEnter = (date: Date) =>
  {
    if (isDragging && isValidDate(date)) {
      // Check if we've actually moved to a different date
      if (dragEnd && format(date, 'yyyy-MM-dd') !== format(dragEnd, 'yyyy-MM-dd')) {
        hasDragged.current = true
      }
      setDragEnd(date)
    }
  }

  const handleMouseUp = (e: React.MouseEvent) =>
  {
    if (isDragging) {
      const range = getDragRange()
      if (range.length > 1 || hasDragged.current) {
        // It was a drag - select the range
        setSelectedDates(new Set(range))
        setIsSelecting(true)
        if (dragStart) setSelectionAnchor(dragStart)
      } else if (range.length === 1 && dragStart && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // It was a simple click - toggle the date
        toggleDate(dragStart)
      }
      setIsDragging(false)
      setDragStart(null)
      setDragEnd(null)
    }
  }

  // Touch handlers (mobile)
  const handleTouchStart = (date: Date, e: React.TouchEvent) =>
  {
    if (!isValidDate(date)) return

    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    touchStartDate.current = date
    hasDragged.current = false

    setDragStart(date)
    setDragEnd(date)
  }

  const handleTouchMove = (e: React.TouchEvent) =>
  {
    if (!touchStartPos.current || !touchStartDate.current) return

    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartPos.current.x)
    const dy = Math.abs(touch.clientY - touchStartPos.current.y)

    // Consider it a drag if moved more than 10px
    if (dx > 10 || dy > 10) {
      hasDragged.current = true
      setIsDragging(true)

      // Find the date under the touch point
      const element = document.elementFromPoint(touch.clientX, touch.clientY)
      const dateStr = element?.getAttribute('data-date')

      if (dateStr) {
        const date = new Date(dateStr)
        if (isValidDate(date)) {
          setDragEnd(date)
        }
      }
    }
  }

  const handleTouchEnd = () =>
  {
    if (hasDragged.current) {
      // It was a drag - select the range
      const range = getDragRange()
      if (range.length > 0) {
        setSelectedDates(new Set(range))
        setIsSelecting(true)
        if (dragStart) setSelectionAnchor(dragStart)
      }
    } else if (touchStartDate.current) {
      // It was a tap - toggle the date
      toggleDate(touchStartDate.current)
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
    touchStartPos.current = null
    touchStartDate.current = null
  }

  // Apply selection action
  const applySelection = (mode: 'available' | 'unavailable' | 'price', price?: number) =>
  {
    if (selectedDates.size === 0) return

    const updates: DayAvailability[] = Array.from(selectedDates).map(dateKey =>
    {
      const date = new Date(dateKey)
      const existing = getDayAvailability(date)
      return {
        ...existing,
        date,
        isAvailable: mode === 'available' ? true : mode === 'unavailable' ? false : existing.isAvailable,
        priceOverride: mode === 'price' && price !== undefined ? price : existing.priceOverride
      }
    })

    onAvailabilityChange(updates)
    cancelSelection()
  }

  // Cancel selection
  const cancelSelection = () =>
  {
    setSelectedDates(new Set())
    setIsSelecting(false)
    setSelectionAnchor(null)
    setPriceInput('')
    setShowPricePopover(false)
  }

  // Check if a date has price adjustments applied
  const hasAdjustment = useCallback((date: Date): boolean =>
  {
    const dayName = WEEKDAY_NAMES[date.getDay()]
    return priceAdjustments.some(adj => adj.isActive && adj.appliesToDays?.includes(dayName))
  }, [priceAdjustments])

  // Get day styling
  const getDayStyles = (date: Date) =>
  {
    const dayData = getDayAvailability(date)
    const isPast = isBefore(date, new Date()) && !isToday(date)
    const dateKey = format(date, 'yyyy-MM-dd')
    const isSelected = selectedDates.has(dateKey)
    const isInDragRange = isDragging && getDragRange().includes(dateKey)
    const hasCustomPrice = dayData.priceOverride !== null
    const hasAutoAdjustment = hasAdjustment(date) && !hasCustomPrice
    const isOffer = isOfferDay(date)
    const isBooked = isBookedDay(date)

    return cn(
      'relative h-14 w-full p-1 text-sm border border-border/50 transition-all select-none',
      !isSameMonth(date, currentMonth) && 'text-muted-foreground/50',
      isPast && 'bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50',
      !isPast && !readOnly && !isOffer && !isBooked && 'cursor-pointer hover:brightness-95 active:scale-95',
      // Booked days - gray, locked (highest priority)
      isBooked && !isPast && 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed line-through',
      // Offer days — dark green, locked
      isOffer && !isPast && 'bg-emerald-600 dark:bg-emerald-700 text-white cursor-not-allowed',
      isOffer && !isPast && isBooked && 'bg-emerald-800 dark:bg-emerald-200 text-gray-400 cursor-not-allowed',
      // Availability coloring (base layer) — skip if offer day or booked
      !isOffer && !isBooked && !dayData.isAvailable && !isPast && 'bg-red-100 dark:bg-red-900/30',
      !isOffer && !isBooked && dayData.isAvailable && !isPast && !hasAutoAdjustment && 'bg-green-50 dark:bg-green-900/20',
      // Adjustment applied - purple/violet tint
      !isOffer && !isBooked && dayData.isAvailable && !isPast && hasAutoAdjustment && 'bg-violet-100 dark:bg-violet-900/30',
      // Custom price override indicator - amber ring
      !isOffer && !isBooked && hasCustomPrice && !isSelected && !isInDragRange && 'ring-2 ring-inset ring-amber-400 dark:ring-amber-500',
      // Drag preview
      isInDragRange && !isSelected && 'bg-blue-200 dark:bg-blue-800/50',
      // Selection highlight
      isSelected && 'bg-blue-500 dark:bg-blue-600 text-white ring-2 ring-blue-600 dark:ring-blue-400 z-10',
      isToday(date) && 'font-bold'
    )
  }

  // Get sorted selection range for display
  const selectionRange = useMemo(() =>
  {
    if (selectedDates.size === 0) return null
    const dates = Array.from(selectedDates).map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime())
    return { start: dates[0], end: dates[dates.length - 1], count: dates.length }
  }, [selectedDates])

  const weekdayLabels = [
    t('actions.sunday_short', { defaultValue: 'Sun' }),
    t('actions.monday_short', { defaultValue: 'Mon' }),
    t('actions.tuesday_short', { defaultValue: 'Tue' }),
    t('actions.wednesday_short', { defaultValue: 'Wed' }),
    t('actions.thursday_short', { defaultValue: 'Thu' }),
    t('actions.friday_short', { defaultValue: 'Fri' }),
    t('actions.saturday_short', { defaultValue: 'Sat' }),
  ]

  return (
    <div
      className={cn('space-y-4', className)}
      style={{ userSelect: 'none' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Selection hint */}
      {!isSelecting && (
        <p className="text-xs text-muted-foreground">
          <span className="hidden sm:inline">{t('hint.desktop')}</span>
          <span className="sm:hidden">{t('hint.mobile')}</span>
        </p>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0">
        {weekdayLabels.map((day, i) => (
          <div key={i} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        className="grid grid-cols-7 gap-0 calendar-grid"
        onMouseUp={handleMouseUp}
        onMouseLeave={() =>
        {
          if (isDragging) {
            setIsDragging(false)
            setDragStart(null)
            setDragEnd(null)
          }
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Empty cells for days before month starts */}
        {Array.from({ length: monthDays[0].getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="h-14 border border-border/30" />
        ))}

        {/* Month days */}
        {monthDays.map(date =>
        {
          const dayData = getDayAvailability(date)
          const price = calculatePrice(date)
          const dateKey = format(date, 'yyyy-MM-dd')
          const isSelected = selectedDates.has(dateKey)
          const hasCustomPrice = dayData.priceOverride !== null

          return (
            <div
              key={date.toISOString()}
              data-date={dateKey}
              className={getDayStyles(date)}
              onClick={(e) => handleDayClick(date, e)}
              onMouseDown={(e) => handleMouseDown(date, e)}
              onMouseEnter={() => handleMouseEnter(date)}
              onTouchStart={(e) => handleTouchStart(date, e)}
            >
              <span className="block">{format(date, 'd')}</span>
              <span className={cn(
                "block text-xs truncate",
                isSelected ? "text-white/90" : "text-muted-foreground",
                hasCustomPrice && !isSelected && "text-amber-600 dark:text-amber-400 font-medium",
                offerDaysMap.has(dateKey) && "text-white/90 font-medium"
              )}>
                {offerDaysMap.has(dateKey) && offerDaysMap.get(dateKey)!.offerPrice
                  ? (bookedDaysMap.has(dateKey) ? t('booked') : `${offerDaysMap.get(dateKey)!.offerPrice} ${currency}`)
                  : (bookedDaysMap.has(dateKey) ? t('booked') : `${price} ${currency}`)
                }
              </span>
            </div>
          )
        })}
      </div>

      {/* Selection actions */}
      {isSelecting && selectionRange && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <span className="text-sm font-medium">
            {selectionRange.count === 1
              ? format(selectionRange.start, 'MMM d')
              : `${format(selectionRange.start, 'MMM d')} - ${format(selectionRange.end, 'MMM d')} (${t('daysCount', { count: selectionRange.count })})`
            }
          </span>
          <div className="flex-1" />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => applySelection('available')}>
              {t('actions.available')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => applySelection('unavailable')}>
              {t('actions.block')}
            </Button>
            <Popover open={showPricePopover} onOpenChange={setShowPricePopover}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline">{t('actions.setPrice')}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="space-y-2">
                  <Label>{t('actions.priceLabel', { currency })}</Label>
                  <Input
                    type="number"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder={basePrice.toString()}
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() =>
                    {
                      const price = parseFloat(priceInput) || basePrice
                      applySelection('price', price)
                    }}
                  >
                    {t('actions.apply')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {onRequestOffer && (
              <Popover open={showOfferPricePopover} onOpenChange={setShowOfferPricePopover}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1"
                    disabled={selectedDates.size > MAX_OFFER_DAYS}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    {t('actions.makeOffer')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('actions.offerPriceLabel')}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={offerPriceInput}
                      onChange={(e) => setOfferPriceInput(e.target.value)}
                      placeholder={basePrice.toString()}
                    />
                    {offerPriceInput && parseFloat(offerPriceInput) >= basePrice && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {t('actions.offerPriceNote', { price: basePrice, currency })}
                      </p>
                    )}
                    <Button
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      disabled={!offerPriceInput || parseFloat(offerPriceInput) <= 0}
                      onClick={() =>
                      {
                        const price = parseFloat(offerPriceInput)
                        if (!price || price <= 0) return
                        const dates = Array.from(selectedDates).sort()
                        onRequestOffer(dates, price)
                        setOfferPriceInput('')
                        setShowOfferPricePopover(false)
                        cancelSelection()
                      }}
                    >
                      {t('actions.submitOffer')}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button size="sm" variant="ghost" onClick={cancelSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {onRequestOffer && selectedDates.size > MAX_OFFER_DAYS && (
            <p className="text-xs text-destructive mt-1">
              {t('actions.offerLimitError', { limit: MAX_OFFER_DAYS })}
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-50 dark:bg-green-900/20 border rounded" />
          <span>{t('legend.available')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-violet-100 dark:bg-violet-900/30 border rounded" />
          <span>{t('legend.adjustment')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 dark:bg-red-900/30 border rounded" />
          <span>{t('legend.blocked')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border-2 border-amber-400 rounded" />
          <span>{t('legend.customPrice')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-600 rounded" />
          <span>{t('legend.offer')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-neutral-100 dark:bg-neutral-800 border rounded" />
          <span>{t('legend.booked')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span>{t('legend.selected')}</span>
        </div>
      </div>
    </div>
  )
}

export default AvailabilityCalendar

