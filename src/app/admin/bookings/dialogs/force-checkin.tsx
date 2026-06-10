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
import { adminForceCheckin } from '../actions'

interface ForceCheckinDialogProps
{
  bookingId: string
  onComplete: () => void
}

export function ForceCheckinDialog({
  bookingId,
  onComplete,
}: ForceCheckinDialogProps)
{
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleConfirm()
  {
    startTransition(async () =>
    {
      const result = await adminForceCheckin(bookingId, reason.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Guest checked in successfully')
        setReason('')
        setOpen(false)
        onComplete()
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="bg-blue-600 text-white hover:bg-blue-700" size="sm">
          Force Check-in
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Force Check-in</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the guest as checked in and activate the booking.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="checkin-reason">Reason</Label>
          <Textarea
            id="checkin-reason"
            placeholder="Explain why this check-in is being forced..."
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
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isPending ? 'Checking in...' : 'Confirm Check-in'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
