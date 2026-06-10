'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AdminBooking,
  getBookingGroup,
  STATUS_COLORS,
  formatCurrency,
} from '../types'

type GroupConfig = {
  key: 'upcoming' | 'active' | 'history'
  label: string
  color: string
  defaultOpen: boolean
}

const GROUPS: GroupConfig[] = [
  { key: 'upcoming', label: 'UPCOMING', color: 'bg-blue-500', defaultOpen: true },
  { key: 'active', label: 'ACTIVE', color: 'bg-green-500', defaultOpen: true },
  { key: 'history', label: 'HISTORY', color: 'bg-gray-500', defaultOpen: false },
]

function BookingGroup({
  config,
  bookings,
  onSelectBooking,
}: {
  config: GroupConfig
  bookings: AdminBooking[]
  onSelectBooking: (b: AdminBooking) => void
}) {
  const [open, setOpen] = useState(config.defaultOpen)

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${config.color}`} />
        <span className="text-sm font-semibold tracking-wide">
          {config.label}
        </span>
        <Badge variant="secondary" className="ml-1">
          {bookings.length}
        </Badge>
      </button>

      {open && (
        <div className="border-t">
          {bookings.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No bookings in this group.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => {
                  const listingTitle = b.listing?.title ?? 'Unknown listing'
                  const guestName =
                    b.guest?.full_name ?? b.guest?.email ?? 'Unknown guest'
                  const checkIn = new Date(b.check_in).toLocaleDateString()
                  const checkOut = new Date(b.check_out).toLocaleDateString()

                  return (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onSelectBooking(b)}
                    >
                      <TableCell className="font-medium">
                        {listingTitle}
                      </TableCell>
                      <TableCell>{guestName}</TableCell>
                      <TableCell>
                        {checkIn} &ndash; {checkOut}
                      </TableCell>
                      <TableCell>{formatCurrency(b.subtotal)}</TableCell>
                      <TableCell>
                        <Badge
                          className={`${STATUS_COLORS[b.status]} text-white`}
                        >
                          {b.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}

export function BoardView({
  bookings,
  onSelectBooking,
}: {
  bookings: AdminBooking[]
  onSelectBooking: (b: AdminBooking) => void
}) {
  const grouped = bookings.reduce<Record<string, AdminBooking[]>>(
    (acc, b) => {
      const group = getBookingGroup(b.status)
      if (!acc[group]) acc[group] = []
      acc[group].push(b)
      return acc
    },
    {}
  )

  return (
    <div className="space-y-4">
      {GROUPS.map((config) => (
        <BookingGroup
          key={config.key}
          config={config}
          bookings={grouped[config.key] ?? []}
          onSelectBooking={onSelectBooking}
        />
      ))}
    </div>
  )
}
