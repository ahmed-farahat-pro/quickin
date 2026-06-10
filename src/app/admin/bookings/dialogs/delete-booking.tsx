'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { adminDeleteBooking } from '../actions'

interface DeleteBookingDialogProps {
  bookingId: string
  onComplete: () => void
}

export function DeleteBookingDialog({
  bookingId,
  onComplete,
}: DeleteBookingDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()

  const confirmSlice = bookingId.slice(0, 8)
  const isConfirmed = confirmText === confirmSlice && reason.trim().length > 0

  function handleConfirm() {
    if (!isConfirmed) return
    startTransition(async () => {
      const result = await adminDeleteBooking(bookingId, reason.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Booking deleted permanently')
        setReason('')
        setConfirmText('')
        setOpen(false)
        onComplete()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete Booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Booking</DialogTitle>
          <DialogDescription>
            This will permanently erase this booking and all related data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="delete-reason">Reason</Label>
            <Textarea
              id="delete-reason"
              placeholder="Explain why this booking is being deleted..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              Type <code className="rounded bg-muted px-1 py-0.5 text-sm font-mono">{confirmSlice}</code> to confirm
            </Label>
            <Input
              id="delete-confirm"
              placeholder={confirmSlice}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!isConfirmed || isPending}
            onClick={handleConfirm}
          >
            {isPending ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
