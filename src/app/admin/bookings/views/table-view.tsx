'use client'

import { useCallback } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { columns } from './table-columns'
import { AdminBooking } from '../types'

export function TableView({
  bookings,
  onSelectBooking,
}: {
  bookings: AdminBooking[]
  onSelectBooking: (booking: AdminBooking) => void
})
{
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) =>
    {
      const tr = (e.target as HTMLElement).closest('tr')
      if (!tr) return

      // Find the cell containing the booking ID
      const cellWithId = tr.querySelector('[data-booking-id]')
      const bookingId = cellWithId?.getAttribute('data-booking-id')
      if (bookingId) {
        const booking = bookings.find((b) => b.id === bookingId)
        if (booking) onSelectBooking(booking)
      }
    },
    [bookings, onSelectBooking]
  )

  return (
    <div onClick={handleClick} className="cursor-pointer">
      <DataTable
        columns={columns}
        data={bookings}
        searchKey="guest"
        searchPlaceholder="Search by guest name..."
      />
    </div>
  )
}
