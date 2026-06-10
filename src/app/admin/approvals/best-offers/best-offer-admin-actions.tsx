'use client'

import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { approveBestOffer, rejectBestOffer } from '@/app/actions/best-offers'
import { toast } from 'sonner'
import { useTransition } from 'react'

interface BestOfferAdminActionsProps
{
    offerId: string
}

export function BestOfferAdminActions({ offerId }: BestOfferAdminActionsProps)
{
    const [isPending, startTransition] = useTransition()

    const handleApprove = () =>
    {
        startTransition(async () =>
        {
            const result = await approveBestOffer(offerId)
            if (result.success) {
                toast.success("Request approved successfully")
            } else {
                toast.error(result.error || "Failed to approve request")
            }
        })
    }

    const handleReject = () =>
    {
        startTransition(async () =>
        {
            const result = await rejectBestOffer(offerId)
            if (result.success) {
                toast.success("Request rejected")
            } else {
                toast.error(result.error || "Failed to reject request")
            }
        })
    }

    return (
        <div className="flex justify-end gap-2">
            <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleReject}
                disabled={isPending}
            >
                <X className="h-4 w-4" />
                <span className="sr-only">Reject</span>
            </Button>
            <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={handleApprove}
                disabled={isPending}
            >
                <Check className="h-4 w-4" />
                <span className="sr-only">Approve</span>
            </Button>
        </div>
    )
}
