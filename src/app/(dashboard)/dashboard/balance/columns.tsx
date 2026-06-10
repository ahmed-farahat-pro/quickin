'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

export type Transaction = {
    id: string
    created_at: string
    type: string
    amount: number
    balance_impact: boolean
    notes: string | null
    balance_after: number
}

function formatCurrency(amount: number)
{
    return new Intl.NumberFormat('en-EG', {
        style: 'currency',
        currency: 'EGP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

export const getColumns = (t: any): ColumnDef<Transaction>[] => [
    {
        accessorKey: 'created_at',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('columns.date')} />
        ),
        cell: ({ row }) =>
        {
            const date = new Date(row.getValue('created_at'))
            return (
                <div className="whitespace-nowrap">
                    {date.toLocaleDateString()} <span className="text-xs text-muted-foreground">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            )
        },
    },
    {
        accessorKey: 'type',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('columns.type')} />
        ),
        cell: ({ row }) =>
        {
            const type = row.getValue('type') as string
            const balanceImpact = row.original.balance_impact

            return (
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                        {type}
                    </Badge>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0.5"
                                >
                                    {balanceImpact === false ? t('typeTooltips.externalLabel') : t('typeTooltips.countsLabel')}
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>
                                {balanceImpact === false
                                    ? t('typeTooltips.external')
                                    : t('typeTooltips.counts')}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )
        },
    },
    {
        accessorKey: 'amount',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('columns.amount')} />
        ),
        cell: ({ row }) =>
        {
            const amount = parseFloat(row.getValue('amount'))
            const formatted = formatCurrency(amount)

            return (
                <div className={`font-medium ${amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {amount > 0 ? '+' : ''}{formatted}
                </div>
            )
        },
    },
    {
        accessorKey: 'notes',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('columns.description')} />
        ),
        cell: ({ row }) =>
        {
            return (
                <div className="text-sm text-muted-foreground">
                    {row.getValue('notes') || '—'}
                </div>
            )
        },
    },
    {
        accessorKey: 'balance_after',
        header: ({ column }) => (
            <div className="text-right">
                <DataTableColumnHeader column={column} title={t('columns.balanceAfter')} className="justify-end" />
            </div>
        ),
        cell: ({ row }) =>
        {
            const amount = parseFloat(row.getValue('balance_after'))
            const formatted = formatCurrency(amount)

            return <div className="text-right font-medium">{formatted}</div>
        },
    },
]
