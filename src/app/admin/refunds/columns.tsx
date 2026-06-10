'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { CodeBadge } from '@/components/ui/code-badge'
import { RefundActions } from './refund-actions'

export interface RefundWithDetails
{
    id: string
    reason: string | null
    refund_type: string
    status: string
    policy_applied: string | null
    created_at: string
    computed_amount: number | null
    booking: {
        id: string
        reservation_code: string | null
        subtotal: number
        check_in: string | null
        guest: {
            full_name: string | null
            email: string
        } | null
        listing: {
            title: string | null
        } | null
    } | null
    policy: {
        label: string
    } | null
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

function getDaysBeforeCheckIn(createdAt: string, checkIn: string): number | null
{
    if (!createdAt || !checkIn) return null
    const created = new Date(createdAt)
    const checkInDate = new Date(checkIn)
    const diffMs = checkInDate.getTime() - created.getTime()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export const columns: ColumnDef<RefundWithDetails>[] = [
    {
        accessorKey: 'created_at',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) =>
        {
            const date = new Date(row.getValue('created_at'))
            return (
                <div className="whitespace-nowrap">
                    {date.toLocaleDateString()}
                    <div className="text-xs text-muted-foreground">
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            )
        },
    },
    {
        id: 'guest',
        accessorFn: (row) => row.booking?.guest?.full_name || row.booking?.guest?.email || 'Unknown',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Guest" />
        ),
        cell: ({ row }) =>
        {
            const refund = row.original
            const guest = refund.booking?.guest
            const resCode = refund.booking?.reservation_code
            return (
                <div className="space-y-1">
                    <div className="font-medium leading-none">{guest?.full_name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{guest?.email || ''}</div>
                    {resCode && (
                        <CodeBadge code={resCode} variant="secondary" className="font-mono text-[10px]" />
                    )}
                </div>
            )
        },
    },
    {
        id: 'listing',
        accessorFn: (row) => row.booking?.listing?.title || '',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Listing" />
        ),
        cell: ({ row }) =>
        {
            const title = row.original.booking?.listing?.title
            return (
                <div className="max-w-[180px] truncate font-medium text-xs" title={title || ''}>
                    {title || 'Unknown Listing'}
                </div>
            )
        },
    },
    {
        id: 'policy',
        accessorFn: (row) => row.policy?.label || row.policy_applied || '',
        header: 'Policy',
        cell: ({ row }) =>
        {
            const label = row.original.policy?.label || row.original.policy_applied
            return label ? (
                <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                    {label}
                </Badge>
            ) : (
                <span className="text-xs text-muted-foreground">N/A</span>
            )
        },
    },
    {
        accessorKey: 'refund_type',
        header: 'Type',
        cell: ({ row }) => (
            <span className="capitalize text-xs">{row.getValue('refund_type')}</span>
        ),
    },
    {
        id: 'breakdown',
        header: 'Breakdown',
        cell: ({ row }) =>
        {
            const refund = row.original
            const booking = refund.booking
            const amount = refund.computed_amount
            const daysBeforeCheckIn = (refund.created_at && booking?.check_in)
                ? getDaysBeforeCheckIn(refund.created_at, booking.check_in)
                : null

            const refundPercentage = (amount && booking?.subtotal)
                ? Math.round((amount / booking.subtotal) * 100)
                : null

            return (
                <div className="text-[10px] space-y-0.5 leading-tight">
                    {refundPercentage !== null && booking?.subtotal && (
                        <div className="text-muted-foreground">
                            {refundPercentage}% of {formatCurrency(booking.subtotal)}
                        </div>
                    )}
                    {daysBeforeCheckIn !== null && (
                        <div className="text-muted-foreground italic">
                            {daysBeforeCheckIn > 0
                                ? `${daysBeforeCheckIn}d before check-in`
                                : daysBeforeCheckIn === 0
                                    ? 'Day of check-in'
                                    : `${Math.abs(daysBeforeCheckIn)}d after check-in`}
                        </div>
                    )}
                </div>
            )
        },
    },
    {
        accessorKey: 'computed_amount',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) =>
        {
            const amount = row.getValue('computed_amount') as number | null
            return (
                <span className="font-semibold text-red-600">
                    {amount ? formatCurrency(amount) : (
                        <span className="text-muted-foreground italic text-xs">Pending</span>
                    )}
                </span>
            )
        },
    },
    {
        accessorKey: 'status',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) =>
        {
            const status = row.getValue('status') as string
            return (
                <Badge
                    variant={
                        status === 'processed' ? 'default' :
                            status === 'approved' ? 'secondary' :
                                status === 'rejected' ? 'destructive' :
                                    status === 'pending' ? 'outline' : 'outline'
                    }
                    className={
                        status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' : ''
                    }
                >
                    {status}
                </Badge>
            )
        },
        filterFn: (row, id, value) =>
        {
            return value.includes(row.getValue(id))
        },
    },
    {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) =>
        {
            const refund = row.original
            const policyLabel = refund.policy?.label || refund.policy_applied
            const daysBeforeCheckIn = (refund.created_at && refund.booking?.check_in)
                ? getDaysBeforeCheckIn(refund.created_at, refund.booking.check_in)
                : null

            if (refund.status === 'pending' || refund.status === 'approved') {
                return (
                    <div className="flex justify-end font-medium">
                        <RefundActions
                            refundId={refund.id}
                            status={refund.status as any}
                            amount={refund.computed_amount ?? 0}
                            bookingTotal={refund.booking?.subtotal}
                            refundType={refund.refund_type}
                            policyLabel={policyLabel || undefined}
                            daysBeforeCheckIn={daysBeforeCheckIn}
                            reason={refund.reason || undefined}
                        />
                    </div>
                )
            }
            return null
        },
    },
]
