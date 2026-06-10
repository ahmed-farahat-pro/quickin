'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import
{
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { type AdminBooking, STATUS_COLORS, formatCurrency } from './types'
import { getBookingDetails } from './actions'
import { CancelBookingDialog } from './dialogs/cancel-booking'
import { ForceCompleteDialog } from './dialogs/force-complete'
import { ForceCheckinDialog } from './dialogs/force-checkin'
import { DeleteBookingDialog } from './dialogs/delete-booking'
import { EditBookingDialog } from './dialogs/edit-booking'
import { ChatDrawer } from '@/components/chat-drawer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BookingDetails = {
  fees: {
    guest_fee?: number
    total_with_fees?: number
    host_payout?: number
  } | null
  escrowEvents: {
    id: string
    type: string
    status: string
    created_at: string
    notes: string | null
  }[]
  auditEvents: {
    id: string
    action: string
    created_at: string
    new_data: Record<string, unknown> | null
  }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveJoin<T>(data: T | T[] | null): T | null
{
  if (data == null) return null
  return Array.isArray(data) ? data[0] ?? null : data
}

function formatDate(dateStr: string): string
{
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function relativeTime(dateStr: string): string
{
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHr > 0) return `${diffHr}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'just now'
}

function escrowLabel(type: string): string
{
  switch (type) {
    case 'hold':
      return 'Payment Held'
    case 'release':
      return 'Escrow Released'
    case 'refund':
      return 'Refund Issued'
    default:
      return type
  }
}

function computeNights(checkIn: string, checkOut: string): number
{
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.ceil(ms / 86400000)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BookingDetailSheetProps
{
  booking: AdminBooking | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BookingDetailSheet({
  booking,
  open,
  onOpenChange,
}: BookingDetailSheetProps)
{
  const [details, setDetails] = useState<BookingDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const prevBookingIdRef = useRef<string | null>(null)

  // Reset state synchronously when booking changes (render-time setState is safe in React)
  const bookingId = booking?.id ?? null
  if (bookingId !== prevBookingIdRef.current) {
    prevBookingIdRef.current = bookingId
    if (!bookingId) {
      setDetails(null)
      setLoading(false)
    } else {
      setLoading(true)
    }
  }

  useEffect(() =>
  {
    if (!bookingId) return

    let cancelled = false

    getBookingDetails(bookingId).then((result) =>
    {
      if (cancelled) return
      if ('error' in result && result.error) {
        setDetails({ fees: null, escrowEvents: [], auditEvents: [] })
      } else {
        setDetails({
          fees: (result.fees as BookingDetails['fees']) ?? null,
          escrowEvents:
            (result.escrowEvents as BookingDetails['escrowEvents']) ?? [],
          auditEvents:
            (result.auditEvents as BookingDetails['auditEvents']) ?? [],
        })
      }
      setLoading(false)
    })

    return () =>
    {
      cancelled = true
    }
  }, [bookingId])

  if (!booking) return null

  const listing = resolveJoin(booking.listing)
  const guest = resolveJoin(booking.guest)
  const host = listing
    ? resolveJoin((listing as AdminBooking['listing'] & { host?: { full_name: string | null } })?.host ?? null)
    : null
  const listingTitle = listing?.title ?? 'Untitled listing'
  const hostName = host?.full_name ?? 'Unknown host'

  const nights = computeNights(booking.check_in, booking.check_out)

  // Build timeline events
  const timelineEvents: { label: string; time: string }[] = [
    { label: 'Created', time: booking.created_at },
  ]

  if (details) {
    for (const ev of details.escrowEvents) {
      timelineEvents.push({
        label: escrowLabel(ev.type),
        time: ev.created_at,
      })
    }
    for (const ev of details.auditEvents) {
      timelineEvents.push({
        label: ev.action.replace(/^admin\.booking\./, 'Admin: '),
        time: ev.created_at,
      })
    }
  }

  timelineEvents.sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  )

  function handleActionComplete()
  {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[480px] sm:w-[540px] overflow-y-auto px-3"
      >
        {/* Header */}
        <SheetHeader>
          <SheetTitle className="leading-snug">{listingTitle}</SheetTitle>
          <SheetDescription className="sr-only">
            Booking detail panel
          </SheetDescription>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs text-muted-foreground truncate max-w-[180px]">
              {booking.id}
            </code>
            <Badge className={STATUS_COLORS[booking.status]}>
              {booking.status}
            </Badge>
            {booking.escrow_status && (
              <Badge variant="outline">{booking.escrow_status}</Badge>
            )}
          </div>
        </SheetHeader>

        {/* Details Grid */}
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <DetailRow label="Guest" value={guest?.full_name ?? 'Unknown'} />
          <DetailRow label="Email" value={guest?.email ?? '-'} />
          <DetailRow label="Host" value={hostName} />
          <DetailRow label="Check-in" value={formatDate(booking.check_in)} />
          <DetailRow label="Check-out" value={formatDate(booking.check_out)} />
          <DetailRow label="Nights" value={String(nights)} />
          <DetailRow label="Guests" value={String(booking.guests)} />
          <DetailRow
            label="Subtotal"
            value={formatCurrency(booking.subtotal)}
          />

          {/* Fee details — loaded async */}
          {loading ? (
            <>
              <SkeletonRow label="Guest Fee" />
              <SkeletonRow label="Total" />
              <SkeletonRow label="Host Payout" />
            </>
          ) : details?.fees ? (
            <>
              <DetailRow
                label="Guest Fee"
                value={
                  details.fees.guest_fee != null
                    ? formatCurrency(details.fees.guest_fee)
                    : '-'
                }
              />
              <DetailRow
                label="Total"
                value={
                  details.fees.total_with_fees != null
                    ? formatCurrency(details.fees.total_with_fees)
                    : '-'
                }
              />
              <DetailRow
                label="Host Payout"
                value={
                  details.fees.host_payout != null
                    ? formatCurrency(details.fees.host_payout)
                    : '-'
                }
              />
            </>
          ) : (
            <>
              <DetailRow label="Guest Fee" value="-" />
              <DetailRow label="Total" value="-" />
              <DetailRow label="Host Payout" value="-" />
            </>
          )}

          <DetailRow
            label="Payment"
            value={
              booking.escrow_status === 'held' || 
              booking.escrow_status === 'released' || 
              booking.escrow_status === 'refunded'
                ? 'Platform balance'
                : booking.receipt_url 
                  ? 'Manual (receipt)' 
                  : 'Manual (pending receipt)'
            }
          />
        </div>

        <Separator className="my-6" />

        {/* Event Timeline */}
        <div>
          <h4 className="text-sm font-medium mb-4">Timeline</h4>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="size-3 rounded-full mt-0.5 shrink-0" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative space-y-0">
              {timelineEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-3 pb-4 relative">
                  {/* Vertical line */}
                  {i < timelineEvents.length - 1 && (
                    <div className="absolute left-[5px] top-3 bottom-0 w-px bg-border" />
                  )}
                  {/* Dot */}
                  <div className="size-[11px] rounded-full bg-primary border-2 border-background mt-0.5 shrink-0 z-10" />
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {ev.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {relativeTime(ev.time)}
                      <span className="mx-1">&middot;</span>
                      {formatDate(ev.time)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* Actions */}
        <div>
          <h4 className="text-sm font-medium mb-3">Actions</h4>
          <div className="mb-4">
            <ChatDrawer bookingId={booking.id} />
          </div>
          <div className="flex flex-wrap gap-2">
            {/* pending / stalled */}
            {(booking.status === 'pending' || booking.status === 'stalled') && (
              <div className="inline-flex -space-x-px rounded-md shadow-sm [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:focus-visible]:z-10 [&>button:hover]:z-10">
                <CancelBookingDialog
                  bookingId={booking.id}
                  onComplete={handleActionComplete}
                />
                <DeleteBookingDialog
                  bookingId={booking.id}
                  onComplete={handleActionComplete}
                />
              </div>
            )}

            {/* confirmed */}
            {booking.status === 'confirmed' && (
              <div className="inline-flex -space-x-px rounded-md shadow-sm [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:focus-visible]:z-10 [&>button:hover]:z-10">
                <EditBookingDialog
                  bookingId={booking.id}
                  currentCheckIn={booking.check_in}
                  currentCheckOut={booking.check_out}
                  currentGuests={booking.guests}
                  onComplete={handleActionComplete}
                />
                <ForceCheckinDialog
                  bookingId={booking.id}
                  onComplete={handleActionComplete}
                />
                <CancelBookingDialog
                  bookingId={booking.id}
                  onComplete={handleActionComplete}
                />
              </div>
            )}

            {/* active */}
            {booking.status === 'active' && (
              <div className="inline-flex -space-x-px rounded-md shadow-sm [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:focus-visible]:z-10 [&>button:hover]:z-10">
                <ForceCompleteDialog
                  bookingId={booking.id}
                  onComplete={handleActionComplete}
                />
              </div>
            )}

            {/* rejected */}
            {booking.status === 'rejected' && (
              <div className="inline-flex -space-x-px rounded-md shadow-sm [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:focus-visible]:z-10 [&>button:hover]:z-10">
                <DeleteBookingDialog
                  bookingId={booking.id}
                  onComplete={handleActionComplete}
                />
              </div>
            )}

            {/* Payment verification link for pending/stalled */}
            {(booking.status === 'pending' || booking.status === 'stalled') && (
              <Link
                href="/admin/payments"
                className="text-sm text-primary underline underline-offset-4 hover:text-primary/80 self-center"
              >
                Payment verification &rarr;
              </Link>
            )}
          </div>

          {/* Empty state for statuses with no actions */}
          {(booking.status === 'completed' ||
            booking.status === 'cancelled') && (
              <p className="text-sm text-muted-foreground">
                No actions available for {booking.status} bookings.
              </p>
            )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string })
{
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </>
  )
}

function SkeletonRow({ label }: { label: string })
{
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <Skeleton className="h-4 w-20" />
    </>
  )
}
