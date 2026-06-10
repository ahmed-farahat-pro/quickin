'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns, Condition } from './columns'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { deleteCondition, toggleConditionApproval } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ConditionsTableProps {
  conditions: Condition[]
}

export function ConditionsTable({ conditions }: ConditionsTableProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedCondition, setSelectedCondition] = React.useState<Condition | null>(null)

  const handleDeleteClick = (condition: Condition) => {
    setSelectedCondition(condition)
    setDeleteDialogOpen(true)
  }

  const handleToggleApproval = async (condition: Condition) => {
    try {
      const result = await toggleConditionApproval(condition.id, !condition.is_approved, condition.name)
      if (result.error) throw new Error(result.error)
      toast.success(`Condition ${condition.is_approved ? 'unapproved' : 'approved'} successfully`)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update condition status')
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedCondition) return
    const result = await deleteCondition(selectedCondition.id)
    if (result.error) {
      throw new Error(result.error)
    }
    toast.success('Condition deleted successfully')
    router.refresh()
  }

  const columns = React.useMemo(() => getColumns({ 
    onDelete: handleDeleteClick,
    onToggleApproval: handleToggleApproval
  }), [])

  return (
    <>
      <DataTable 
        columns={columns} 
        data={conditions}
        searchKey="name"
        searchPlaceholder="Filter conditions by name..."
      />
      
      {selectedCondition && (
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Condition"
          itemName={selectedCondition.name}
          description={`Are you sure you want to delete "${selectedCondition.name}"? If it is assigned to listings, this will fail.`}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  )
}
