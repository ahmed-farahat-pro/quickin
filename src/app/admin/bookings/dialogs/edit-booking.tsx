'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import
  {
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
import { adminEditBooking } from '../actions'
import { formatCurrency } from '../types'

interface EditBookingDialogProps
{
  bookingId: string
  currentCheckIn: string
  currentCheckOut: string
  currentGuests: number
  onComplete: () => void
}

export function EditBookingDialog({
  bookingId,
  currentCheckIn,
  currentCheckOut,
  currentGuests,
  onComplete,
}: EditBookingDialogProps)
{
  const [open, setOpen] = useState(false)
  const [checkIn, setCheckIn] = useState(currentCheckIn)
  const [checkOut, setCheckOut] = useState(currentCheckOut)
  const [guests, setGuests] = useState(currentGuests)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  const hasChanges =
    checkIn !== currentCheckIn ||
    checkOut !== currentCheckOut ||
    guests !== currentGuests

  const canSubmit = hasChanges && reason.trim().length > 0 && !isPending

  // Reset form fields when dialog opens
  function handleOpenChange(nextOpen: boolean)
  {
    if (nextOpen) {
      setCheckIn(currentCheckIn)
      setCheckOut(currentCheckOut)
      setGuests(currentGuests)
      setReason('')
    }
    setOpen(nextOpen)
  }

  function handleConfirm()
  {
    if (!canSubmit) return
    startTransition(async () =>
    {
      const result = await adminEditBooking(
        bookingId,
        { checkIn, checkOut, guests },
        reason.trim(),
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        if (
          result.newSubtotal != null &&
          result.oldSubtotal != null &&
          result.newSubtotal !== result.oldSubtotal
        ) {
          toast.success(
            `Booking updated. Price: ${formatCurrency(result.oldSubtotal)} \u2192 ${formatCurrency(result.newSubtotal)}`,
          )
        } else {
          toast.success('Booking updated successfully')
        }
        setReason('')
        setOpen(false)
        onComplete()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Edit Booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
          <DialogDescription>
            Update the booking dates or guest count. The subtotal will be
            recalculated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-checkin">Check-in</Label>
              <Input
                id="edit-checkin"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-checkout">Check-out</Label>
              <Input
                id="edit-checkout"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-guests">Guests</Label>
            <Input
              id="edit-guests"
              type="number"
              min={1}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reason">Reason</Label>
            <Textarea
              id="edit-reason"
              placeholder="Explain why this booking is being modified..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
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
          <Button disabled={!canSubmit} onClick={handleConfirm}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
