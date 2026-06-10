'use client'

import { DataTable } from '@/components/ui/data-table'
import { columns, BookingWithReceipt } from './columns'

interface PaymentsTableProps {
  verifications: BookingWithReceipt[]
}

export function PaymentsTable({ verifications }: PaymentsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={verifications}
      searchKey="guest"
      searchPlaceholder="Filter by guest..."
    />
  )
}
