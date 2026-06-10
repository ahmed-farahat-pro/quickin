'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns, UserBan } from './columns'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { deleteBan, liftBan } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface BansTableProps {
  bans: UserBan[]
}

export function BansTable({ bans }: BansTableProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedBan, setSelectedBan] = React.useState<UserBan | null>(null)

  const handleDeleteClick = (ban: UserBan) => {
    setSelectedBan(ban)
    setDeleteDialogOpen(true)
  }

  const handleLiftBan = async (ban: UserBan) => {
    try {
      const result = await liftBan(ban.id)
      if (result.error) throw new Error(result.error)
      toast.success('Ban lifted successfully')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to lift ban')
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedBan) return
    const result = await deleteBan(selectedBan.id)
    if (result.error) {
      throw new Error(result.error)
    }
    toast.success('Ban record deleted successfully')
    router.refresh()
  }

  const columns = React.useMemo(() => getColumns({ 
    onDelete: handleDeleteClick,
    onLiftBan: handleLiftBan
  }), [])

  return (
    <>
      <DataTable 
        columns={columns} 
        data={bans}
        searchKey="target_user"
        searchPlaceholder="Filter by user..."
      />
      
      {selectedBan && (
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Ban Record"
          itemName="Ban Record"
          description={`Are you sure you want to delete this ban record for ${selectedBan.target_user?.full_name}? This completely removes the history of this ban.`}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  )
}
