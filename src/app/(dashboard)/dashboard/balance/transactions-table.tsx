'use client'

import { getColumns, Transaction } from './columns'
import { DataTable } from '@/components/ui/data-table'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

interface TransactionsTableProps
{
    data: Transaction[]
}

export function TransactionsTable({ data }: TransactionsTableProps)
{
    const t = useTranslations('dashboardBalanceTable')
    const columns = useMemo(() => getColumns(t), [t])

    return (
        <DataTable
            columns={columns}
            data={data}
            searchKey="notes"
            searchPlaceholder={t('searchPlaceholder')}
        />
    )
}
