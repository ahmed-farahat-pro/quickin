'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns, BestOffer } from './columns'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { deleteOffer, updateOfferStatus } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface OffersTableProps {
  offers: BestOffer[]
}

export function OffersTable({ offers }: OffersTableProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedOffer, setSelectedOffer] = React.useState<BestOffer | null>(null)

  const handleDeleteClick = (offer: BestOffer) => {
    setSelectedOffer(offer)
    setDeleteDialogOpen(true)
  }

  const handleUpdateStatus = async (offer: BestOffer, status: 'approved' | 'rejected') => {
    try {
      const result = await updateOfferStatus(offer.id, status)
      if (result.error) throw new Error(result.error)
      toast.success(`Offer ${status} successfully`)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update offer status')
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedOffer) return
    const result = await deleteOffer(selectedOffer.id)
    if (result.error) {
      throw new Error(result.error)
    }
    toast.success('Offer deleted successfully')
    router.refresh()
  }

  const columns = React.useMemo(() => getColumns({ 
    onDelete: handleDeleteClick,
    onUpdateStatus: handleUpdateStatus
  }), [])

  return (
    <>
      <DataTable 
        columns={columns} 
        data={offers}
        searchKey="listing" // this will actually search the formatted accessorFn
        searchPlaceholder="Filter offers..."
      />
      
      {selectedOffer && (
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Offer"
          itemName="Best Offer" // Generic since titles are long
          description="Are you sure you want to delete this best offer request?"
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  )
}
