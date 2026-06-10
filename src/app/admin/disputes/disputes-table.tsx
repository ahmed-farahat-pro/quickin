'use client'

import { DataTable } from '@/components/ui/data-table'
import { columns, Dispute } from './columns'

interface DisputesTableProps {
  disputes: Dispute[]
}

export function DisputesTable({ disputes }: DisputesTableProps) {
  return (
    <DataTable 
      columns={columns} 
      data={disputes}
      searchKey="subject"
      searchPlaceholder="Filter by subject..."
    />
  )
}
