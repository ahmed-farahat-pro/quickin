'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns, Review } from './columns'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { deleteReview, toggleReviewVisibility } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ReviewsTableProps {
  reviews: Review[]
}

export function ReviewsTable({ reviews }: ReviewsTableProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedReview, setSelectedReview] = React.useState<Review | null>(null)

  const handleDeleteClick = (review: Review) => {
    setSelectedReview(review)
    setDeleteDialogOpen(true)
  }

  const handleToggleVisibility = async (review: Review) => {
    try {
      const result = await toggleReviewVisibility(review.id, !review.is_hidden)
      if (result.error) throw new Error(result.error)
      toast.success(`Review ${review.is_hidden ? 'published' : 'hidden'} successfully`)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update review visibility')
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedReview) return
    const result = await deleteReview(selectedReview.id)
    if (result.error) {
      throw new Error(result.error)
    }
    toast.success('Review deleted successfully')
    router.refresh()
  }

  const columns = React.useMemo(() => getColumns({ 
    onDelete: handleDeleteClick,
    onToggleVisibility: handleToggleVisibility
  }), [])

  return (
    <>
      <DataTable 
        columns={columns} 
        data={reviews}
        searchKey="listing"
        searchPlaceholder="Filter by listing title..."
      />
      
      {selectedReview && (
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Review"
          itemName="Review"
          description={`Are you sure you want to completely delete this review by ${selectedReview.reviewer?.full_name || 'this user'}? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  )
}
