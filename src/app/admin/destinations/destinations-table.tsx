'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns } from './columns'
import { SearchDestination } from '@/types/database'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { deleteDestination } from './actions'

interface DestinationsTableProps {
  destinations: SearchDestination[]
}

export function DestinationsTable({ destinations }: DestinationsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedDestination, setSelectedDestination] = React.useState<SearchDestination | null>(null)

  const handleDeleteClick = (destination: SearchDestination) => {
    setSelectedDestination(destination)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedDestination) return
    const result = await deleteDestination(selectedDestination.id)
    if (result.error) {
      throw new Error(result.error)
    }
  }

  const columns = React.useMemo(() => getColumns({ onDelete: handleDeleteClick }), [])

  return (
    <>
      <DataTable 
        columns={columns} 
        data={destinations}
        searchKey="label"
        searchPlaceholder="Filter by label..."
      />

      {selectedDestination && (
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Destination"
          itemName={selectedDestination.label}
          description={`Are you sure you want to delete ${selectedDestination.label}? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  )
}

