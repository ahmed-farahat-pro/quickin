'use client'

import { DataTable } from '@/components/ui/data-table'
import { columns, AuditLog } from './columns'

interface AuditTableProps {
  logs: AuditLog[]
}

export function AuditTable({ logs }: AuditTableProps) {
  return (
    <DataTable 
      columns={columns} 
      data={logs}
      searchKey="action"
      searchPlaceholder="Filter by action..."
    />
  )
}
