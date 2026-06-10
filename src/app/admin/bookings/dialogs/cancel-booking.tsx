'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
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
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { adminCancelBooking } from '../actions'

interface CancelBookingDialogProps
{
  bookingId: string
  onComplete: () => void
}

export function CancelBookingDialog({
  bookingId,
  onComplete,
}: CancelBookingDialogProps)
{
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleConfirm()
  {
    startTransition(async () =>
    {
      const result = await adminCancelBooking(bookingId, reason.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Booking cancelled successfully')
        setReason('')
        setOpen(false)
        onComplete()
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Cancel Booking
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel the booking and notify the host and guest. For
            confirmed bookings with held funds, a full refund will be issued.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea
            id="cancel-reason"
            placeholder="Explain why this booking is being cancelled..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!reason.trim() || isPending}
            onClick={(e) =>
            {
              e.preventDefault()
              handleConfirm()
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending ? 'Cancelling...' : 'Confirm Cancel'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
