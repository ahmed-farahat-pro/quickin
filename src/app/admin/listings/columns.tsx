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
import { Eye, MoreHorizontal, Pencil, Trash, Check } from 'lucide-react'
import Link from 'next/link'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

import { CodeBadge } from '@/components/ui/code-badge'
import { reviewListing } from './actions'
import { publishListing } from '@/lib/actions/listing-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { UnpublishDialog } from '@/components/features/listings/unpublish-dialog'
import { Ban, Globe } from 'lucide-react'

export interface Listing {
  id: string
  title: string
  is_published: boolean
  review_status: 'draft' | 'pending_review' | 'approved' | 'rejected'
  price_per_night: number
  created_at: string
  host: {
    full_name: string | null
    email: string
  } | null
  city: string | null
  country: string | null
  listing_code: string | null
  active_booking_count: number
}

interface ColumnActionsProps {
  onDelete: (listing: Listing) => void
}

function AdminActions({ 
  listing, 
  onDelete 
}: { 
  listing: Listing, 
  onDelete: (listing: Listing) => void 
}) {
  const [isUnpublishDialogOpen, setIsUnpublishDialogOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const handleReview = async (action: 'approve' | 'reject') => {
    const notes = action === 'reject' ? window.prompt('Reason for rejection:') : undefined;
    if (action === 'reject' && !notes) return; // cancelled
    
    toast.promise(reviewListing(listing.id, action, notes || undefined), {
      loading: `Marking as ${action}d...`,
      success: () => {
        router.refresh()
        return `Listing ${action}d successfully.`
      },
      error: 'Failed to update review status'
    });
  }

  const handlePublish = async () => {
    setIsPending(true)
    try {
      const result = await publishListing(listing.id)
      if (result.success) {
        toast.success('Listing published successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to publish listing')
      }
    } catch (_error) {
      toast.error('Failed to publish listing')
    } finally {
      setIsPending(false)
    }
  }


  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isPending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {listing.review_status === 'pending_review' && (
            <>
              <DropdownMenuItem asChild className="text-blue-600 focus:text-blue-600 font-medium">
                <Link href={`/admin/listings/${listing.id}/review`}>
                  <Eye className="h-4 w-4 mr-2" />
                  Review Changes
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleReview('approve')} className="text-green-600 focus:text-green-600 font-medium">
                <Check className="h-4 w-4 mr-2" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleReview('reject')} className="text-red-600 focus:text-red-600 font-medium">
                <Trash className="h-4 w-4 mr-2" />
                Reject
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/admin/listings/${listing.id}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Listing
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/listings/${listing.id}`} target="_blank">
              <Eye className="h-4 w-4 mr-2" />
              View Listing
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {listing.is_published ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setIsUnpublishDialogOpen(true)}
            >
              <Ban className="h-4 w-4 mr-2" />
              Unpublish
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-green-600 focus:text-green-600"
              onClick={handlePublish}
              disabled={listing.review_status !== 'approved'}
            >
              <Globe className="h-4 w-4 mr-2" />
              Publish
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => onDelete(listing)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UnpublishDialog
        listingId={listing.id}
        isOpen={isUnpublishDialogOpen}
        onOpenChange={setIsUnpublishDialogOpen}
        activeBookingCount={listing.active_booking_count}
        isAdmin={true}
      />
    </>
  )
}

export function getColumns(actions: ColumnActionsProps): ColumnDef<Listing>[] {
  return [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => {
        const code = row.original.listing_code
        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium max-w-[200px] truncate">
              {row.getValue('title')}
            </div>
            {code && <CodeBadge code={code} label="#" variant="outline" className="w-fit text-[10px] h-5 px-1.5" />}
          </div>
        )
      },
    },
    {
      id: 'host',
      accessorFn: (row) => row.host?.full_name || row.host?.email || 'Unknown',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Host" />
      ),
      cell: ({ row }) => {
        const listing = row.original
        return (
          <div className="text-sm">
            <div>{listing.host?.full_name || 'Unknown'}</div>
            <div className="text-muted-foreground text-xs">
              {listing.host?.email}
            </div>
          </div>
        )
      },
    },
    {
      id: 'location',
      accessorFn: (row) => 
        row.city && row.country ? `${row.city}, ${row.country}` : '-',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
    },
    {
      accessorKey: 'price_per_night',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Price" />
      ),
      cell: ({ row }) => {
        return `$${row.getValue('price_per_night')}/night`
      },
    },
    {
      accessorKey: 'is_published',
      header: 'Published',
      cell: ({ row }) => {
        const isPublished = row.getValue('is_published') as boolean
        return isPublished ? (
          <Badge className="bg-green-500">Yes</Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'review_status',
      header: 'Review Status',
      cell: ({ row }) => {
        const status = row.getValue('review_status') as string
        if (status === 'pending_review') return <Badge variant="destructive">Pending Review</Badge>
        if (status === 'approved') return <Badge className="bg-green-500">Approved</Badge>
        if (status === 'rejected') return <Badge variant="secondary">Rejected</Badge>
        return <Badge variant="outline">Draft</Badge>
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => {
        return new Date(row.getValue('created_at')).toLocaleDateString()
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        return <AdminActions listing={row.original} onDelete={actions.onDelete} />
      },
    },
  ]
}


