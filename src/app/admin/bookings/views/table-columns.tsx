'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, ArrowRight } from 'lucide-react'
import { AdminBooking, STATUS_COLORS, formatCurrency } from '../types'

export const columns: ColumnDef<AdminBooking>[] = [
  {
    accessorKey: 'listing',
    header: 'Listing',
    cell: ({ row }) =>
    {
      const listing = row.original.listing
      const title = Array.isArray(listing) ? listing[0]?.title : listing?.title
      return (
        <div data-booking-id={row.original.id} className="max-w-[180px] truncate font-medium">
          {title || 'Unknown'}
        </div>
      )
    },
  },
  {
    accessorKey: 'guest',
    header: 'Guest',
    cell: ({ row }) =>
    {
      const guest = row.original.guest
      const name = Array.isArray(guest)
        ? guest[0]?.full_name
        : guest?.full_name
      return name || 'Unknown'
    },
    filterFn: (row, _columnId, filterValue: string) =>
    {
      const guest = row.original.guest
      const name = Array.isArray(guest)
        ? guest[0]?.full_name
        : guest?.full_name
      return (name ?? '')
        .toLowerCase()
        .includes(filterValue.toLowerCase())
    },
  },
  {
    id: 'host',
    header: 'Host',
    cell: ({ row }) =>
    {
      const listing = row.original.listing
      const host = Array.isArray(listing)
        ? listing[0]?.host
        : listing?.host
      const name = Array.isArray(host) ? host[0]?.full_name : host?.full_name
      return name || 'Unknown'
    },
  },
  {
    accessorKey: 'check_in',
    header: 'Check-in',
    cell: ({ row }) => new Date(row.original.check_in).toLocaleDateString(),
  },
  {
    accessorKey: 'check_out',
    header: 'Check-out',
    cell: ({ row }) => new Date(row.original.check_out).toLocaleDateString(),
  },
  {
    accessorKey: 'guests',
    header: 'Guests',
  },
  {
    accessorKey: 'subtotal',
    header: 'Subtotal',
    cell: ({ row }) => formatCurrency(row.original.subtotal),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge className={STATUS_COLORS[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'escrow_status',
    header: 'Escrow',
    cell: ({ row }) => (
      <Badge variant="outline">
        {row.original.escrow_status || 'none'}
      </Badge>
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const messagesCount = Array.isArray(row.original.booking_messages) 
        ? row.original.booking_messages[0]?.count || 0 
        : 0
      
      return (
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2 pointer-events-none"
          >
            <span>Details</span>
            {messagesCount > 0 && (
              <div className="flex items-center text-muted-foreground ml-2 border-l pl-2 border-border">
                <MessageSquare className="h-3 w-3 mr-1" />
                <span className="text-xs">{messagesCount}</span>
              </div>
            )}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )
    }
  },
]
