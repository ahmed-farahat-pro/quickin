'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns, Listing } from './columns'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { deleteListing } from './actions'

interface ListingsTableProps {
  listings: Listing[]
}

export function ListingsTable({ listings }: ListingsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedListing, setSelectedListing] = React.useState<Listing | null>(null)

  const handleDeleteClick = (listing: Listing) => {
    setSelectedListing(listing)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedListing) return
    const result = await deleteListing(selectedListing.id)
    if (result.error) {
      throw new Error(result.error)
    }
  }

  const columns = React.useMemo(() => getColumns({ onDelete: handleDeleteClick }), [])

  return (
    <>
      <DataTable 
        columns={columns} 
        data={listings}
        searchKey="title"
        searchPlaceholder="Filter by title..."
      />
      
      {selectedListing && (
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Listing"
          itemName={selectedListing.title}
          description={`Are you sure you want to delete "${selectedListing.title}"? This will permanently remove the listing and all its associated data.`}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  )
}

