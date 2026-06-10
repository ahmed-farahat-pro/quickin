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
import { adminForceComplete } from '../actions'

interface ForceCompleteDialogProps
{
  bookingId: string
  onComplete: () => void
}

export function ForceCompleteDialog({
  bookingId,
  onComplete,
}: ForceCompleteDialogProps)
{
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleConfirm()
  {
    startTransition(async () =>
    {
      const result = await adminForceComplete(bookingId, reason.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Booking marked as completed')
        setReason('')
        setOpen(false)
        onComplete()
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="bg-green-600 text-white hover:bg-green-700" size="sm">
          Force Complete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Force Complete Booking</AlertDialogTitle>
          <AlertDialogDescription>
            This will release escrow funds to the host and mark the booking as
            completed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="complete-reason">Reason</Label>
          <Textarea
            id="complete-reason"
            placeholder="Explain why this booking is being force-completed..."
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
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {isPending ? 'Completing...' : 'Confirm Complete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
