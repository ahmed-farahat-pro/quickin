'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns, Attribute } from './columns'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { deleteAttribute, toggleAttributeStatus } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface AttributesTableProps {
  attributes: Attribute[]
}

export function AttributesTable({ attributes }: AttributesTableProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedAttribute, setSelectedAttribute] = React.useState<Attribute | null>(null)

  const handleDeleteClick = (attribute: Attribute) => {
    setSelectedAttribute(attribute)
    setDeleteDialogOpen(true)
  }

  const handleToggleStatus = async (attribute: Attribute) => {
    try {
      const result = await toggleAttributeStatus(attribute.id, !attribute.is_enabled, attribute.label)
      if (result.error) throw new Error(result.error)
      toast.success(`Attribute ${attribute.is_enabled ? 'disabled' : 'enabled'} successfully`)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update attribute status')
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedAttribute) return
    const result = await deleteAttribute(selectedAttribute.id)
    if (result.error) {
      throw new Error(result.error)
    }
    router.refresh()
  }

  const columns = React.useMemo(() => getColumns({ 
    onDelete: handleDeleteClick,
    onToggleStatus: handleToggleStatus
  }), [])

  return (
    <>
      <DataTable 
        columns={columns} 
        data={attributes}
        searchKey="label"
        searchPlaceholder="Filter attributes by label..."
      />
      
      {selectedAttribute && (
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Attribute"
          itemName={selectedAttribute.label}
          description={`Are you sure you want to delete "${selectedAttribute.label}"? If this is in use by listings, the deletion will be blocked.`}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  )
}
