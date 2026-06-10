'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AdminBooking, formatCurrency } from '../types'

type Zoom = 'day' | 'week' | 'month'

const ZOOM_CONFIG: Record<Zoom, { days: number; colWidth: number; label: string }> = {
  day: { days: 21, colWidth: 56, label: 'Day' },
  week: { days: 56, colWidth: 24, label: 'Week' },
  month: { days: 90, colWidth: 12, label: 'Month' },
}

const ROW_HEIGHT = 44
const LEFT_COL_WIDTH = 200

const BAR_COLORS: Record<AdminBooking['status'], string> = {
  active: 'bg-green-500',
  confirmed: 'bg-blue-500',
  pending: 'bg-yellow-500',
  stalled: 'bg-yellow-500',
  completed: 'bg-gray-400',
  cancelled: 'bg-red-400',
  rejected: 'bg-red-400',
}

type ListingRow = {
  listingId: string
  listingTitle: string
  hostName: string
  bookings: AdminBooking[]
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateFull(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function TimelineView({
  bookings,
  onSelectBooking,
}: {
  bookings: AdminBooking[]
  onSelectBooking: (booking: AdminBooking) => void
}) {
  const [zoom, setZoom] = useState<Zoom>('day')
  const scrollRef = useRef<HTMLDivElement>(null)

  const config = ZOOM_CONFIG[zoom]
  const today = useMemo(() => startOfDay(new Date()), [])

  const dateRange = useMemo(() => {
    const start = new Date(today)
    start.setDate(start.getDate() - 3)
    const end = new Date(start)
    end.setDate(end.getDate() + config.days)
    return { start: startOfDay(start), end: startOfDay(end) }
  }, [today, config.days])

  const dates = useMemo(() => {
    const arr: Date[] = []
    const current = new Date(dateRange.start)
    while (current < dateRange.end) {
      arr.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return arr
  }, [dateRange])

  const totalDays = dates.length

  const listingRows = useMemo(() => {
    const map = new Map<string, ListingRow>()

    for (const booking of bookings) {
      const checkIn = startOfDay(new Date(booking.check_in))
      const checkOut = startOfDay(new Date(booking.check_out))

      // Skip bookings that don't overlap with visible range
      if (checkOut <= dateRange.start || checkIn >= dateRange.end) continue

      const id = booking.listing_id
      if (!map.has(id)) {
        map.set(id, {
          listingId: id,
          listingTitle: booking.listing?.title ?? 'Unknown Listing',
          hostName: booking.listing?.host?.full_name ?? 'Unknown Host',
          bookings: [],
        })
      }
      map.get(id)!.bookings.push(booking)
    }

    return Array.from(map.values()).sort((a, b) =>
      a.listingTitle.localeCompare(b.listingTitle)
    )
  }, [bookings, dateRange])

  // Auto-scroll to today on mount and zoom change
  useEffect(() => {
    if (scrollRef.current) {
      const todayOffset = daysBetween(dateRange.start, today) * config.colWidth
      scrollRef.current.scrollLeft = Math.max(0, todayOffset - 200)
    }
  }, [zoom, dateRange.start, today, config.colWidth])

  const gridWidth = totalDays * config.colWidth

  const todayIndex = daysBetween(dateRange.start, today)
  const todayX = todayIndex >= 0 && todayIndex < totalDays ? todayIndex * config.colWidth : null

  // Determine which date headers to show
  const shouldShowLabel = (date: Date): boolean => {
    if (zoom === 'day') return true
    if (zoom === 'week') return date.getDay() === 1 // Monday
    if (zoom === 'month') return date.getDate() === 1
    return false
  }

  if (listingRows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <ZoomControls zoom={zoom} onZoomChange={setZoom} />
        </div>
        <div className="flex items-center justify-center rounded-lg border bg-muted/30 py-16 text-muted-foreground">
          No bookings in this date range.
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="flex justify-end">
          <ZoomControls zoom={zoom} onZoomChange={setZoom} />
        </div>

        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="flex">
            {/* Left fixed column */}
            <div
              className="shrink-0 border-r bg-muted/30"
              style={{ width: LEFT_COL_WIDTH }}
            >
              {/* Header */}
              <div
                className="flex items-center border-b px-3 text-sm font-medium text-muted-foreground"
                style={{ height: ROW_HEIGHT }}
              >
                Listing
              </div>
              {/* Listing rows */}
              {listingRows.map((row) => (
                <div
                  key={row.listingId}
                  className="flex flex-col justify-center border-b px-3"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="truncate text-sm font-medium leading-tight">
                    {row.listingTitle}
                  </div>
                  <div className="truncate text-xs text-muted-foreground leading-tight">
                    {row.hostName}
                  </div>
                </div>
              ))}
            </div>

            {/* Right scrollable area */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto">
              <div style={{ width: gridWidth, minWidth: '100%' }}>
                {/* Date header */}
                <div
                  className="relative flex border-b"
                  style={{ height: ROW_HEIGHT }}
                >
                  {dates.map((date, i) => {
                    const isToday = isSameDay(date, today)
                    const show = shouldShowLabel(date)
                    return (
                      <div
                        key={i}
                        className={`shrink-0 flex items-end justify-center pb-1 text-xs border-r border-border/40 ${
                          isToday
                            ? 'bg-primary/10 font-semibold text-primary'
                            : 'text-muted-foreground'
                        }`}
                        style={{ width: config.colWidth }}
                      >
                        {show ? formatDateShort(date) : ''}
                      </div>
                    )
                  })}
                </div>

                {/* Grid body */}
                {listingRows.map((row) => (
                  <div
                    key={row.listingId}
                    className="relative border-b"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Vertical grid lines */}
                    {dates.map((date, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 border-r border-border/20 ${
                          isSameDay(date, today) ? 'bg-primary/5' : ''
                        }`}
                        style={{
                          left: i * config.colWidth,
                          width: config.colWidth,
                        }}
                      />
                    ))}

                    {/* Today marker */}
                    {todayX !== null && (
                      <div
                        className="absolute top-0 bottom-0 z-10 w-0.5 bg-red-500"
                        style={{ left: todayX }}
                      />
                    )}

                    {/* Booking bars */}
                    {row.bookings.map((booking) => {
                      const checkIn = startOfDay(new Date(booking.check_in))
                      const checkOut = startOfDay(new Date(booking.check_out))

                      const startOffset = daysBetween(dateRange.start, checkIn)
                      const endOffset = daysBetween(dateRange.start, checkOut)

                      const clampedStart = Math.max(0, startOffset)
                      const clampedEnd = Math.min(totalDays, endOffset)

                      if (clampedStart >= clampedEnd) return null

                      const left = clampedStart * config.colWidth
                      const width = (clampedEnd - clampedStart) * config.colWidth

                      const barColor = BAR_COLORS[booking.status]
                      const guestName = booking.guest?.full_name ?? 'Guest'
                      const showText = width > 60

                      const amount = booking.best_offer_subtotal ?? booking.subtotal

                      return (
                        <Tooltip key={booking.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={`absolute z-20 flex items-center overflow-hidden rounded-md px-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 ${barColor}`}
                              style={{
                                left,
                                width,
                                top: 6,
                                height: 28,
                              }}
                              onClick={() => onSelectBooking(booking)}
                            >
                              {showText && (
                                <span className="truncate">{guestName}</span>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-1">
                              <div className="font-medium">{guestName}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDateFull(checkIn)} &rarr;{' '}
                                {formatDateFull(checkOut)}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span>{formatCurrency(amount)}</span>
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${barColor}`}
                                >
                                  {booking.status}
                                </span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

function ZoomControls({
  zoom,
  onZoomChange,
}: {
  zoom: Zoom
  onZoomChange: (z: Zoom) => void
}) {
  return (
    <div className="flex gap-1">
      {(['day', 'week', 'month'] as Zoom[]).map((z) => (
        <Button
          key={z}
          size="sm"
          variant={zoom === z ? 'default' : 'outline'}
          onClick={() => onZoomChange(z)}
        >
          {ZOOM_CONFIG[z].label}
        </Button>
      ))}
    </div>
  )
}
