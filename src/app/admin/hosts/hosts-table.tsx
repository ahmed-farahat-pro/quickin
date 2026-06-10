'use client'

import { DataTable } from '@/components/ui/data-table'
import { columns, Host } from './columns'

interface HostsTableProps {
  hosts: Host[]
}

export function HostsTable({ hosts }: HostsTableProps) {
  return (
    <DataTable 
      columns={columns} 
      data={hosts}
      searchKey="email"
      searchPlaceholder="Filter by email..."
    />
  )
}
