'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { CodeBadge } from '@/components/ui/code-badge'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, Check, X, Loader2, ExternalLink } from 'lucide-react'
import { approveBookingPayment, rejectBookingPayment } from './actions'
import { toast } from 'sonner'

export interface BookingWithReceipt
{
  id: string
  reservation_code: string | null
  status: string
  subtotal: number
  paid_amount: number | null
  best_offer_subtotal: number
  total_with_fees: number
  escrow_status: string | null
  receipt_url: string
  created_at: string
  guest: {
    id: string
    full_name: string | null
    email: string
  } | null
  listing: {
    id: string
    title: string | null
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

function getPaymentMethodBadge()
{
  return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Mobile Wallet</Badge>
}

function getStatusBadge(status: string)
{
  switch (status) {
    case 'pending':
      return <Badge className="bg-yellow-500">Pending Review</Badge>
    case 'confirmed':
      return <Badge className="bg-green-500">Confirmed</Badge>
    case 'active':
      return <Badge className="bg-blue-500">Active (In Stay)</Badge>
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export function ActionButtons({ booking, onAction, isModal }: { booking: BookingWithReceipt; onAction?: () => void; isModal?: boolean })
{
  const [isPending, startTransition] = useTransition()
  const [isApproveOpen, setIsApproveOpen] = useState(false)
  const [paidAmountStr, setPaidAmountStr] = useState(booking.total_with_fees.toString())

  if (booking.status !== 'pending' && booking.status !== 'stalled') {
    return isModal ? null : <span className="text-muted-foreground text-xs">No actions</span>
  }

  const handleApprove = () =>
  {
    const amount = Number(paidAmountStr)
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid amount')
      return
    }

    startTransition(async () =>
    {
      const result = await approveBookingPayment(booking.id, amount)
      if (result.success) {
        if (result.message) {
          toast.success(result.message)
        } else {
          toast.success('Payment approved and booking confirmed')
        }
        setIsApproveOpen(false)
        onAction?.()
      } else {
        toast.error(result.error || 'Failed to approve payment')
      }
    })
  }

  const handleReject = () =>
  {
    startTransition(async () =>
    {
      const result = await rejectBookingPayment(booking.id)
      if (result.success) {
        toast.success('Payment rejected and booking cancelled')
        onAction?.()
      } else {
        toast.error(result.error || 'Failed to reject payment')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Approve
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payment</DialogTitle>
            <DialogDescription>
              Verify the amount transferred by the guest to confirm this booking.
              The total expected amount is {formatCurrency(booking.total_with_fees)}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor="paidAmount" className="text-sm font-medium">
                Actual Paid Amount (EGP)
              </label>
              <Input
                id="paidAmount"
                type="number"
                min="0"
                step="0.01"
                value={paidAmountStr}
                onChange={(e) => setPaidAmountStr(e.target.value)}
                placeholder="Enter paid amount..."
              />
              <p className="text-xs text-muted-foreground">
                If the guest paid more than the total, the excess will be refunded to their wallet.
                If they paid less, the booking will be stalled until the remaining balance is paid.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={isPending} className="bg-green-600 hover:bg-green-700">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Reject
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently reject the payment
              and mark the booking as cancelled. The user will need to create a new booking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ReceiptCell({ row }: { row: { original: BookingWithReceipt } })
{
  const [isOpen, setIsOpen] = useState(false)
  const url = row.original.receipt_url

  if (!url) return <span className="text-muted-foreground">-</span>

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Eye className="h-3.5 w-3.5" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Receipt</DialogTitle>
          <DialogDescription>
            Uploaded for reservation {row.original.reservation_code || 'Unknown'}
          </DialogDescription>
        </DialogHeader>
        <div className="relative group flex justify-center p-4 bg-muted/20 rounded-md">
          {['confirmed', 'active', 'completed'].includes(row.original.status) && (
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
              <Badge className="bg-green-500 hover:bg-green-500 text-white text-sm px-3 py-1 shadow-md">
                <Check className="h-4 w-4 mr-1.5" />
                Approved
              </Badge>
            </div>
          )}
          {row.original.status === 'cancelled' && (
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
              <Badge variant="destructive" className="bg-red-500 hover:bg-red-500 text-white text-sm px-3 py-1 shadow-md">
                <X className="h-4 w-4 mr-1.5" />
                Rejected
              </Badge>
            </div>
          )}
          <img
            src={url}
            alt="Payment Receipt"
            className="max-h-[60vh] object-contain rounded-md border shadow-sm"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-6 right-6 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <DialogFooter className="flex items-center justify-end pt-2">
          <ActionButtons booking={row.original} onAction={() => setIsOpen(false)} isModal />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const columns: ColumnDef<BookingWithReceipt>[] = [
  {
    id: 'guest',
    accessorFn: (row) => row.guest?.full_name || row.guest?.email || 'Unknown',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Guest" />
    ),
    cell: ({ row }) =>
    {
      const v = row.original
      return (
        <div className="text-sm">
          <div className="font-medium">{v.guest?.full_name || 'Unknown'}</div>
          <div className="text-muted-foreground text-xs">{v.guest?.email}</div>
        </div>
      )
    },
  },
  {
    id: 'reservation_code',
    accessorFn: (row) => row.reservation_code || '',
    header: 'Reservation',
    cell: ({ row }) =>
    {
      const code = row.original.reservation_code
      return code ? (
        <CodeBadge code={code} variant="secondary" className="font-mono text-xs" />
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      )
    },
  },
  {
    id: 'listing',
    accessorFn: (row) => row.listing?.title || '',
    header: 'Property',
    cell: ({ row }) =>
    {
      const title = row.original.listing?.title
      return title ? (
        <span className="text-sm">{title}</span>
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      )
    },
  },
  {
    id: 'payment_method',
    header: 'Method',
    cell: () => getPaymentMethodBadge(),
  },
  {
    accessorKey: 'total_with_fees',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) =>
    {
      return (
        <span className="font-medium">
          {formatCurrency(row.getValue('total_with_fees'))}
        </span>
      )
    },
  },
  {
    id: 'receipt',
    header: 'Receipt',
    cell: ({ row }) => <ReceiptCell row={row} />,
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
    accessorKey: 'escrow_status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Escrow" />
    ),
    cell: ({ row }) =>
    {
      const status = (row.getValue('escrow_status') as string) || 'none'
      const colors: Record<string, string> = {
        none: 'bg-slate-500',
        held: 'bg-blue-500',
        released: 'bg-green-500',
        refunded: 'bg-orange-500'
      }
      return (
        <Badge className={`${colors[status] || 'bg-slate-500'} capitalize`}>
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Submitted" />
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
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => <ActionButtons booking={row.original} />,
  },
]
