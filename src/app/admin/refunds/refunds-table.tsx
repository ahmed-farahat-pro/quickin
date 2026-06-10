'use client'

import { DataTable } from '@/components/ui/data-table'
import { columns, RefundWithDetails } from './columns'

interface RefundsTableProps
{
    refunds: RefundWithDetails[]
}

export function RefundsTable({ refunds }: RefundsTableProps)
{
    return (
        <DataTable
            columns={columns}
            data={refunds}
            searchKey="guest"
            searchPlaceholder="Filter by guest name or email..."
        />
    )
}
