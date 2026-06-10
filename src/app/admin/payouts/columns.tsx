'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { PayoutActions } from './payout-actions'
import { PaymentDetailsModal } from './payment-details-modal'

export interface Payout
{
  id: string
  host_id: string
  computed_amount: number | null
  status: string
  created_at: string
  host: {
    full_name: string | null
    email: string
  } | null
  payout_method?: string
  payment_method_details?: {
    type: string
    provider_name?: string
    account_number: string
    account_holder_name: string
    bank_name?: string
    iban?: string
    swift_code?: string
  } | null
}

function formatCurrency(amount: number)
{
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
  }).format(amount)
}

function getStatusBadge(status: string)
{
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>
    case 'processing':
      return <Badge className="bg-yellow-500">Processing</Badge>
    case 'completed':
      return <Badge className="bg-green-500">Completed</Badge>
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export const columns: ColumnDef<Payout>[] = [
  {
    id: 'host',
    accessorFn: (row) => row.host?.full_name || row.host?.email || 'Unknown',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Host" />
    ),
    cell: ({ row }) =>
    {
      const payout = row.original
      return (
        <div className="text-sm">
          <div className="font-medium">{payout.host?.full_name || 'Unknown'}</div>
          <div className="text-muted-foreground text-xs">{payout.host?.email}</div>
        </div>
      )
    },
  },
  {
    accessorKey: 'computed_amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.computed_amount != null ? formatCurrency(Math.abs(row.original.computed_amount)) : '-'}
      </span>
    ),
  },
  {
    id: 'method',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Payment Method" />
    ),
    cell: ({ row }) => {
      const payout = row.original
      const details = payout.payment_method_details
      
      return (
        <div className="flex items-center justify-between gap-2 min-w-[140px]">
          <div className="text-xs flex-1">
            {details ? (
              <>
                <div className="font-medium">
                  {details.provider_name || details.type.replace('_', ' ')}
                </div>
                <div className="text-muted-foreground break-all max-w-[120px]">
                  {details.account_number}
                </div>
              </>
            ) : (
              <span className="text-muted-foreground italic">{payout.payout_method || 'Unknown'}</span>
            )}
          </div>
          <PaymentDetailsModal 
            payoutId={payout.id}
            hostId={payout.host_id}
            requestedDetails={details}
            requestedMethod={payout.payout_method || 'Unknown'}
          />
        </div>
      )
    }
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => getStatusBadge(row.getValue('status')),
    filterFn: (row, id, value) =>
    {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) =>
    {
      return new Date(row.getValue('created_at')).toLocaleDateString()
    },
  },
  {
    id: 'actions',
    cell: ({ row }) =>
    {
      const payout = row.original
      return (
        <PayoutActions
          payoutId={payout.id}
          status={payout.status}
          amount={payout.computed_amount || 0}
          hostName={payout.host?.full_name || 'Unknown'}
          currentMethod={payout.payout_method}
        />
      )
    }
  }
]
