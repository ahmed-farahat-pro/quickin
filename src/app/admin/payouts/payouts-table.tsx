'use client'

import { DataTable } from '@/components/ui/data-table'
import { columns, Payout } from './columns'

interface PayoutsTableProps {
  payouts: Payout[]
}

export function PayoutsTable({ payouts }: PayoutsTableProps) {
  return (
    <DataTable 
      columns={columns} 
      data={payouts}
      searchKey="host"
      searchPlaceholder="Filter by host..."
    />
  )
}
