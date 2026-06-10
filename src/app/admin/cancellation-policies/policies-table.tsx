'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns, CancellationPolicy } from './columns'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { deletePolicy, togglePolicyEnabled } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface PoliciesTableProps {
  policies: CancellationPolicy[]
}

export function PoliciesTable({ policies }: PoliciesTableProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedPolicy, setSelectedPolicy] = React.useState<CancellationPolicy | null>(null)

  const handleDeleteClick = (policy: CancellationPolicy) => {
    setSelectedPolicy(policy)
    setDeleteDialogOpen(true)
  }

  const handleToggleEnabled = async (policy: CancellationPolicy) => {
    try {
      const result = await togglePolicyEnabled(policy.code, !policy.is_enabled, policy.label)
      if (result.error) throw new Error(result.error)
      toast.success(`Policy ${policy.is_enabled ? 'disabled' : 'enabled'} successfully`)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update policy status')
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedPolicy) return
    const result = await deletePolicy(selectedPolicy.code)
    if (result.error) {
      throw new Error(result.error)
    }
    toast.success('Policy deleted successfully')
    router.refresh()
  }

  const columns = React.useMemo(() => getColumns({
    onDelete: handleDeleteClick,
    onToggleEnabled: handleToggleEnabled
  }), [])

  return (
    <>
      <DataTable
        columns={columns}
        data={policies}
        searchKey="label"
        searchPlaceholder="Filter policies by label..."
      />

      {selectedPolicy && (
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Cancellation Policy"
          itemName={selectedPolicy.label}
          description={`Are you sure you want to delete "${selectedPolicy.label}"? If it is assigned to listings, this will fail.`}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  )
}
