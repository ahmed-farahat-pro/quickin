'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { approveRefund, rejectRefund, processRefund } from '@/lib/actions/refunds'
import { toast } from 'sonner'
import { Loader2, Check, X, BanknoteIcon } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import
    {
        AlertDialog,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle,
    } from "@/components/ui/alert-dialog"

interface RefundActionsProps
{
    refundId: string
    status: 'pending' | 'approved'
    amount: number
    bookingTotal?: number
    refundType?: string
    policyLabel?: string
    daysBeforeCheckIn?: number | null
    reason?: string
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

export function RefundActions({
    refundId,
    status,
    amount,
    bookingTotal,
    refundType,
    policyLabel,
    daysBeforeCheckIn,
    reason
}: RefundActionsProps)
{
    const [isPending, startTransition] = useTransition()
    const [dialog, setDialog] = useState<'approve' | 'reject' | 'process' | null>(null)
    const [rejectReason, setRejectReason] = useState('')

    const handleApprove = () =>
    {
        startTransition(async () =>
        {
            const result = await approveRefund(refundId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Refund approved successfully')
            }
            setDialog(null)
        })
    }

    const handleReject = () =>
    {
        if (!rejectReason.trim()) {
            toast.error('Please provide a rejection reason')
            return
        }
        startTransition(async () =>
        {
            const result = await rejectRefund(refundId, rejectReason.trim())
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Refund rejected')
            }
            setDialog(null)
            setRejectReason('')
        })
    }

    const handleProcess = () =>
    {
        startTransition(async () =>
        {
            const result = await processRefund(refundId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Refund marked as processed')
            }
            setDialog(null)
        })
    }

    const refundPercentage = bookingTotal ? Math.round((amount / bookingTotal) * 100) : null

    return (
        <div className="flex items-center justify-end gap-2">
            {status === 'pending' && (
                <>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={isPending}
                        onClick={() => setDialog('reject')}
                    >
                        <X className="h-4 w-4 mr-1 text-red-500" />
                        Reject
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        className="h-8 bg-green-600 hover:bg-green-700"
                        disabled={isPending}
                        onClick={() => setDialog('approve')}
                    >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                    </Button>
                </>
            )}

            {status === 'approved' && (
                <Button
                    variant="default"
                    size="sm"
                    className="h-8"
                    disabled={isPending}
                    onClick={() => setDialog('process')}
                >
                    <BanknoteIcon className="h-4 w-4 mr-1" />
                    Mark Processed
                </Button>
            )}

            {/* Approve Dialog */}
            <AlertDialog open={dialog === 'approve'} onOpenChange={(open) => !open && setDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Refund</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>Review the refund calculation breakdown before approving.</p>
                                <div className="rounded-md bg-muted p-3 space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span>Refund Amount:</span>
                                        <span className="font-semibold text-red-600">{formatCurrency(amount)}</span>
                                    </div>
                                    {bookingTotal && (
                                        <div className="flex justify-between">
                                            <span>Booking Total:</span>
                                            <span>{formatCurrency(bookingTotal)}</span>
                                        </div>
                                    )}
                                    {refundPercentage !== null && (
                                        <div className="flex justify-between">
                                            <span>Refund Percentage:</span>
                                            <span>{refundPercentage}%</span>
                                        </div>
                                    )}
                                    {refundType && (
                                        <div className="flex justify-between">
                                            <span>Type:</span>
                                            <span className="capitalize">{refundType}</span>
                                        </div>
                                    )}
                                    {policyLabel && (
                                        <div className="flex justify-between">
                                            <span>Policy:</span>
                                            <span>{policyLabel}</span>
                                        </div>
                                    )}
                                    {daysBeforeCheckIn !== null && daysBeforeCheckIn !== undefined && (
                                        <div className="flex justify-between">
                                            <span>Cancelled:</span>
                                            <span>
                                                {daysBeforeCheckIn > 0
                                                    ? `${daysBeforeCheckIn} days before check-in`
                                                    : daysBeforeCheckIn === 0
                                                        ? 'Day of check-in'
                                                        : `${Math.abs(daysBeforeCheckIn)} days after check-in`}
                                            </span>
                                        </div>
                                    )}
                                    {reason && (
                                        <div className="pt-1.5 border-t">
                                            <span className="text-muted-foreground">Reason: </span>
                                            <span>{reason}</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Approving will update payout amounts and reduce the host&apos;s on-hold balance.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <Button
                            onClick={handleApprove}
                            disabled={isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Approve Refund
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Dialog */}
            <AlertDialog open={dialog === 'reject'} onOpenChange={(open) => { if (!open) { setDialog(null); setRejectReason('') } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject Refund</AlertDialogTitle>
                        <AlertDialogDescription>
                            The guest will be notified that their refund request of {formatCurrency(amount)} has been rejected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <Label htmlFor="reject-reason">Rejection Reason</Label>
                        <Textarea
                            id="reject-reason"
                            placeholder="Provide a reason for rejection..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="mt-1.5"
                            rows={3}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={isPending || !rejectReason.trim()}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Reject Refund
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Process Dialog */}
            <AlertDialog open={dialog === 'process'} onOpenChange={(open) => !open && setDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Mark Refund as Processed</AlertDialogTitle>
                        <AlertDialogDescription>
                            Confirm that the actual money movement of {formatCurrency(amount)} has been completed. This marks the refund as fully processed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <Button
                            onClick={handleProcess}
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Processed
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
