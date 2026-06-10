'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns, Staff } from './columns'

interface StaffTableProps {
  staff: Staff[]
  isAdmin: boolean
  currentUserId?: string
  toggleStatusAction: (formData: FormData) => Promise<void>
}

export function StaffTable({ staff, isAdmin, currentUserId, toggleStatusAction }: StaffTableProps) {
  const handleToggleStatus = React.useCallback((id: string, currentStatus: boolean) => {
    const formData = new FormData()
    formData.append('id', id)
    formData.append('is_active', String(currentStatus))
    toggleStatusAction(formData)
  }, [toggleStatusAction])

  const columns = React.useMemo(
    () => getColumns({
      isAdmin,
      currentUserId,
      onToggleStatus: handleToggleStatus,
    }),
    [isAdmin, currentUserId, handleToggleStatus]
  )

  return (
    <DataTable 
      columns={columns} 
      data={staff}
      searchKey="email"
      searchPlaceholder="Filter by email..."
    />
  )
}
