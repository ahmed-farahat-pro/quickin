'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateBookingStatusHost } from '@/lib/actions/bookings'
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

interface BookingActionsProps
{
  bookingId: string
}

export function BookingActions({ bookingId }: BookingActionsProps)
{
  const router = useRouter()
  const t = useTranslations('dashboardBookings.actions')
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  const handleApprove = async () =>
  {
    setIsApproving(true)

    try {
      const { error } = await updateBookingStatusHost(bookingId, 'confirmed')

      if (error) throw new Error(error)

      toast.success(t('approveSuccess'))
      router.refresh()
    } catch (error: any) {
      console.error('Error approving booking:', error)
      toast.error(error.message || t('approveError'), {
        action: { label: t('retry'), onClick: () => handleApprove() }
      })
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () =>
  {
    setIsRejecting(true)

    try {
      const { error } = await updateBookingStatusHost(bookingId, 'rejected')

      if (error) throw new Error(error)

      toast.success(t('rejectSuccess'), {
        action: {
          label: t('undo'),
          onClick: async () =>
          {
            await updateBookingStatusHost(bookingId, 'pending')
            router.refresh()
          }
        }
      })
      router.refresh()
    } catch (error: any) {
      console.error('Error rejecting booking:', error)
      toast.error(error.message || t('rejectError'), {
        action: { label: t('retry'), onClick: () => handleReject() }
      })
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        size="sm"
        onClick={handleApprove}
        disabled={isApproving || isRejecting}
        className="gap-1"
      >
        {isApproving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        {t('approve')}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={isApproving || isRejecting}
            className="gap-1"
          >
            {isRejecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            {t('decline')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('dialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

