'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { format } from 'date-fns'
import Link from 'next/link'

export interface BestOffer {
  id: string
  listing_id: string
  start_date: string
  end_date: string
  status: string
  offer_price: number | null
  listing: {
    title: string
  }
}

interface ColumnActionsProps {
  onDelete: (offer: BestOffer) => void
  onUpdateStatus: (offer: BestOffer, status: 'approved' | 'rejected') => void
}

export function getColumns(actions: ColumnActionsProps): ColumnDef<BestOffer>[] {
  return [
    {
      id: 'listing',
      accessorFn: (row) => row.listing?.title || 'Unknown',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Listing" />
      ),
      cell: ({ row }) => {
        return (
          <Link href={`/listings/${row.original.listing_id}`} target="_blank" className="font-medium flex items-center gap-2 hover:underline">
            {row.original.listing?.title}
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </Link>
        )
      }
    },
    {
      id: 'dates',
      header: 'Date Range',
      cell: ({ row }) => {
        const start = new Date(row.original.start_date)
        const end = new Date(row.original.end_date)
        return (
          <div className="text-sm">
            {format(start, 'MMM d, yyyy')} - {format(end, 'MMM d, yyyy')}
          </div>
        )
      }
    },
    {
      accessorKey: 'offer_price',
      header: 'Offer Price',
      cell: ({ row }) => {
        const price = row.getValue('offer_price') as number | null
        return price ? `$${price}` : <span className="text-muted-foreground">Standard</span>
      }
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        
        switch (status) {
          case 'approved':
            return <Badge className="bg-green-500">Approved</Badge>
          case 'rejected':
            return <Badge variant="destructive">Rejected</Badge>
          case 'requested':
            return <Badge variant="secondary" className="text-amber-600 bg-amber-50 border-amber-200">Requested</Badge>
          case 'expired':
            return <Badge variant="outline" className="text-muted-foreground">Expired</Badge>
          default:
            return <Badge variant="outline">{status}</Badge>
        }
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const offer = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {offer.status === 'requested' && (
                <>
                  <DropdownMenuItem onClick={() => actions.onUpdateStatus(offer, 'approved')}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    Approve Request
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => actions.onUpdateStatus(offer, 'rejected')}>
                    <XCircle className="h-4 w-4 mr-2 text-red-600" />
                    Reject Request
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem 
                onClick={() => actions.onDelete(offer)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
