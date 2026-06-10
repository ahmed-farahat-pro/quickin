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
import { MoreHorizontal, Trash, EyeOff, Eye, Star } from 'lucide-react'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { format } from 'date-fns'

export interface Review {
  id: string
  listing_id: string
  user_id: string
  rating: number
  comment: string | null
  is_hidden: boolean
  created_at: string
  listing: { title: string }
  reviewer: { full_name: string, email: string }
}

interface ColumnActionsProps {
  onDelete: (review: Review) => void
  onToggleVisibility: (review: Review) => void
}

export function getColumns(actions: ColumnActionsProps): ColumnDef<Review>[] {
  return [
    {
      id: 'listing',
      accessorFn: (row) => row.listing?.title || 'Unknown',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Listing" />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.listing?.title}</span>
    },
    {
      id: 'reviewer',
      accessorFn: (row) => row.reviewer?.full_name || row.reviewer?.email || 'Unknown',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reviewer" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex flex-col">
            <span>{row.original.reviewer?.full_name || 'Unknown User'}</span>
            <span className="text-xs text-muted-foreground">{row.original.reviewer?.email}</span>
          </div>
        )
      }
    },
    {
      accessorKey: 'rating',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Rating" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-medium">{row.getValue('rating')}</span>
          </div>
        )
      }
    },
    {
      accessorKey: 'comment',
      header: 'Comment',
      cell: ({ row }) => {
        const comment = row.getValue('comment') as string | null
        if (!comment) return <span className="text-muted-foreground italic">No comment</span>
        return (
          <div className="max-w-[300px] truncate text-sm" title={comment}>
            {comment}
          </div>
        )
      }
    },
    {
      accessorKey: 'is_hidden',
      header: 'Status',
      cell: ({ row }) => {
        const isHidden = row.getValue('is_hidden') as boolean
        return isHidden ? (
          <Badge variant="destructive">Hidden</Badge>
        ) : (
          <Badge className="bg-green-500">Public</Badge>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: ({ row }) => {
        return format(new Date(row.getValue('created_at')), 'MMM d, yyyy')
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const review = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.onToggleVisibility(review)}>
                {review.is_hidden ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Make Public
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 mr-2 text-amber-600" />
                    Hide Review
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => actions.onDelete(review)}
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
