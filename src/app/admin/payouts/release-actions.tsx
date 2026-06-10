'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { releaseEscrow } from '@/lib/actions/escrow'
import { toast } from 'sonner'
import { Loader2, CheckCircle2 } from 'lucide-react'
import
    {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle,
        AlertDialogTrigger,
    } from "@/components/ui/alert-dialog"

interface ReleaseActionsProps
{
    bookingId: string
}

export function ReleaseActions({ bookingId }: ReleaseActionsProps)
{
    const [isPending, startTransition] = useTransition()
    const [isOpen, setIsOpen] = useState(false)

    const handleRelease = () =>
    {
        startTransition(async () =>
        {
            const result = await releaseEscrow(bookingId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(`Funds successfully released to host`)
            }
            setIsOpen(false)
        })
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <Button
                variant="default"
                size="sm"
                className="h-8"
                disabled={isPending}
                onClick={() => setIsOpen(true)}
            >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Release Funds
            </Button>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Release Escrow Funds</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to release the held escrow funds for this booking? This will explicitly credit the host's Available Balance. Make sure the guest has already checked in or the booking is completed.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <Button
                        onClick={handleRelease}
                        disabled={isPending}
                    >
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Release
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
