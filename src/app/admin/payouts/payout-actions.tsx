'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, XCircle, Clock, Banknote, Ban } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter } from 'next/navigation'
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

interface PayoutActionsProps
{
    payoutId: string
    status: string
    amount: number
    hostName: string
    currentMethod?: string
}

export function PayoutActions({
    payoutId,
    status,
    amount,
    hostName,
    currentMethod
}: PayoutActionsProps)
{
    const [isPending, startTransition] = useTransition()
    const [actionType, setActionType] = useState<'process' | 'complete' | 'fail' | 'cancel' | null>(null)
    const [notes, setNotes] = useState('')
    const [payoutMethod, setPayoutMethod] = useState(currentMethod || 'vodafone_cash')
    const [payoutReference, setPayoutReference] = useState('')
    const router = useRouter()

    const formatCurrency = (val: number) =>
    {
        return new Intl.NumberFormat('en-EG', {
            style: 'currency',
            currency: 'EGP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(val)
    }

    const handleAction = async () =>
    {
        if (!actionType) return

        startTransition(async () =>
        {
            try {
                const response = await fetch('/api/admin/payouts/process', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payout_id: payoutId,
                        action: actionType,
                        payout_method: actionType === 'process' ? payoutMethod : undefined,
                        payout_reference: actionType === 'complete' ? payoutReference : undefined,
                        notes,
                    })
                })

                const result = await response.json()

                if (!response.ok) {
                    toast.error(result.error || `Failed to ${actionType} payout`)
                } else {
                    toast.success(`Payout ${actionType}${actionType.endsWith('e') ? 'd' : 'ed'} successfully`)
                    router.refresh()
                }
            } catch (error) {
                toast.error('An unexpected error occurred')
                console.error(error)
            } finally {
                setActionType(null)
                setNotes('')
                setPayoutReference('')
            }
        })
    }

    return (
        <div className="flex items-center justify-end gap-2">
            {status === 'pending' && (
                <>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={isPending}
                        onClick={() => setActionType('cancel')}
                    >
                        <Ban className="h-4 w-4 mr-1 text-red-500" />
                        Cancel
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        className="h-8 bg-yellow-600 hover:bg-yellow-700"
                        disabled={isPending}
                        onClick={() => setActionType('process')}
                    >
                        <Clock className="h-4 w-4 mr-1" />
                        Mark Processing
                    </Button>
                </>
            )}

            {status === 'processing' && (
                <>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={isPending}
                        onClick={() => setActionType('fail')}
                    >
                        <XCircle className="h-4 w-4 mr-1 text-red-500" />
                        Fail
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        className="h-8 bg-green-600 hover:bg-green-700"
                        disabled={isPending}
                        onClick={() => setActionType('complete')}
                    >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Complete
                    </Button>
                </>
            )}

            <AlertDialog open={actionType !== null} onOpenChange={(open) => !open && setActionType(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="capitalize">
                            {actionType} Payout
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {actionType === 'process' && `Confirm you are starting to process the withdrawal of ${formatCurrency(amount)} for ${hostName || 'the host'}.`}
                            {actionType === 'complete' && `Confirm the funds have been successfully sent to ${hostName || 'the host'}. This will notify them.`}
                            {actionType === 'fail' && `Mark this payout as failed. The host will be notified to check their details.`}
                            {actionType === 'cancel' && `Cancel this payout request entirely.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4 py-2">
                        {actionType === 'process' && (
                            <div className="space-y-2">
                                <Label htmlFor="payout-method">Verification Method</Label>
                                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                                    <SelectTrigger id="payout-method">
                                        <SelectValue placeholder="Select method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="vodafone_cash">Vodafone Cash</SelectItem>
                                        <SelectItem value="instapay">InstaPay</SelectItem>
                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {actionType === 'complete' && (
                            <div className="space-y-2">
                                <Label htmlFor="payout-ref">Transaction Reference (Optional)</Label>
                                <Input
                                    id="payout-ref"
                                    placeholder="e.g. Bank Ref # or Receipt ID"
                                    value={payoutReference}
                                    onChange={(e) => setPayoutReference(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="action-notes">Internal Notes (Optional)</Label>
                            <Textarea
                                id="action-notes"
                                placeholder="Add any details for audit or the host..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <Button
                            onClick={handleAction}
                            disabled={isPending}
                            className={
                                actionType === 'complete' ? 'bg-green-600 hover:bg-green-700' :
                                    actionType === 'process' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                        'bg-red-600 hover:bg-red-700'
                            }
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm {actionType}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
