'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, XCircle, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cancelBooking } from '@/lib/supabase/bookings'
import { updateBookingStatusGuest, confirmCheckIn, previewCancellationRefund } from '@/lib/actions/bookings'
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
import { GuestQrScanner } from './guest-qr-scanner'
import { ChatDrawer } from '@/components/chat-drawer'

interface RefundPreview {
  refundAmount: number
  refundType: 'full' | 'partial'
  refundPercentage: number
  daysBeforeCheckIn: number
  policyCode: string
  policyLabel?: string
  totalPrice?: number
}

interface GuestBookingActionsProps
{
  bookingId: string
  status: string
  isCheckInConfirmed?: boolean
  refundText?: string
  messageCount?: number
}

export function GuestBookingActions({ 
  bookingId, 
  status, 
  isCheckInConfirmed, 
  refundText,
  messageCount = 0
}: GuestBookingActionsProps)
{
  const router = useRouter()
  const t = useTranslations('dashboardTrips.actions')
  const ct = useTranslations('chatDrawer')
  const [isCancelling, setIsCancelling] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [refundPreview, setRefundPreview] = useState<RefundPreview | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleOpenCancelDialog = async () => {
    setDialogOpen(true)

    if (status !== 'confirmed') return

    setIsLoadingPreview(true)
    setRefundPreview(null)

    try {
      const result = await previewCancellationRefund(bookingId)
      if (result.success && result.refund) {
        setRefundPreview({
          ...result.refund,
          policyLabel: result.policyLabel,
          totalPrice: result.totalPrice,
        })
      }
    } catch (error) {
      console.error('Failed to load refund preview:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleCancelRequest = async () =>
  {
    setIsCancelling(true)
    const supabase = createClient()

    try {
      // 1. Fetch latest status to check for race conditions
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single()

      if (fetchError) throw fetchError

      if (booking.status !== status) {
        toast.error(`Booking status has changed to ${booking.status}. Please refresh the page.`)
        router.refresh()
        return
      }

      // 2. Proceed with cancellation via server action (handles refund)
      const result = await updateBookingStatusGuest(bookingId, 'cancelled', status)

      if (result.error) throw new Error(result.error)

      const refund = (result as any).refund
      if (refund && refund.refundAmount > 0) {
        toast.success(`Booking cancelled. You will receive a ${refund.refundType} refund of ${refund.refundAmount} EGP (${refund.refundPercentage}%).`)
      } else {
        toast.success(t('cancelSuccess'))
      }

      setDialogOpen(false)
      router.refresh()
    } catch (error: any) {
      console.error('Error cancelling booking:', error)
      toast.error(error.message || t('cancelError'), {
        action: { label: t('retry'), onClick: () => handleCancelRequest() }
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const handleConfirmCheckIn = async () =>
  {
    setIsConfirming(true)

    try {
      const { error: updateError } = await confirmCheckIn(bookingId)

      if (updateError) throw updateError

      toast.success(t('checkinSuccess'))
      router.refresh()
    } catch (error: any) {
      console.error('Error confirming check-in:', error)
      toast.error(t('checkinError'))
    } finally {
      setIsConfirming(false)
    }
  }

  const ChatButton = (
    <ChatDrawer 
      bookingId={bookingId} 
      trigger={
        <Button variant="outline" size="sm" className="gap-2 w-full relative">
          <MessageSquare className="h-4 w-4" />
          {ct('chatWithHost')}
          {messageCount > 0 && (
            <Badge 
              variant="secondary" 
              className="h-5 min-w-[20px] flex items-center justify-center p-1 text-[10px] rounded-full bg-primary text-primary-foreground border-none"
            >
              {messageCount}
            </Badge>
          )}
        </Button>
      }
    />
  )

  if (status === 'active' || (status === 'confirmed' && isCheckInConfirmed)) {
    return (
      <div className="w-full mt-2 space-y-2">
        <div className="p-2 bg-green-50 text-green-700 text-sm rounded-md flex items-center justify-center gap-2 border border-green-200">
          <CheckCircle className="h-4 w-4" />
          {t('checkedIn')}
        </div>
        {ChatButton}
      </div>
    )
  }

  if (status !== 'pending' && status !== 'confirmed') return null

  const isConfirmed = status === 'confirmed'

  return (
    <div className="flex flex-col gap-2 w-full mt-2 items-end">
      <div className="w-full">
        {ChatButton}
      </div>

      {isConfirmed && !isCheckInConfirmed && (
        <>
          <Button
            onClick={handleConfirmCheckIn}
            disabled={isConfirming}
            size="sm"
            className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {isConfirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {t('confirmCheckinBtn')}
          </Button>
          <GuestQrScanner bookingId={bookingId} />
        </>
      )}

      {status === 'pending' && (
        <div className="flex flex-col items-end gap-2 text-right w-full mt-2 mb-2">
          <div className="p-2 bg-yellow-50 text-yellow-800 text-sm rounded-md flex items-center justify-center gap-2 border border-yellow-200 w-full">
            <AlertTriangle className="h-4 w-4" />
            {t('processingPayment')}
          </div>
          <p className="text-[10px] text-muted-foreground w-full text-center">
            {t('processingPaymentDesc')}
          </p>
        </div>
      )}

      <div className="flex flex-col items-end w-full">
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant={isConfirmed ? "outline" : "ghost"}
              size="sm"
              className={isConfirmed 
                ? "w-full text-destructive border-destructive hover:bg-destructive/10" 
                : "text-muted-foreground hover:text-destructive h-auto p-0 hover:bg-transparent font-normal"
              }
              onClick={handleOpenCancelDialog}
            >
              <XCircle className={isConfirmed ? "h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" : "h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0"} />
              {isConfirmed ? t('cancel') : t('cancelRequest')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('dialog.title')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>{t('dialog.description')}</p>

                  {isLoadingPreview && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Calculating refund...
                    </div>
                  )}

                  {refundPreview && (
                    <div className="rounded-lg border p-3 space-y-2 text-sm bg-muted/50">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('cancelPolicy')}</span>
                        <span className="font-medium">{refundPreview.policyLabel || refundPreview.policyCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('daysBefore')}</span>
                        <span className="font-medium">{refundPreview.daysBeforeCheckIn}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between">
                        <span className="text-muted-foreground">{t('refundLabel')}</span>
                        {refundPreview.refundAmount > 0 ? (
                          <span className="font-semibold text-green-600">
                            {refundPreview.refundAmount} EGP ({refundPreview.refundPercentage}%)
                          </span>
                        ) : (
                          <span className="font-semibold text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            No refund
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('dialog.keep')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelRequest}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isCancelling || isLoadingPreview}
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="mr-2 rtl:ml-2 rtl:mr-0 h-4 w-4 animate-spin" />
                    {t('cancelling')}
                  </>
                ) : (
                  t('dialog.confirm')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {isConfirmed && refundText && (
          <span className="text-[10px] text-muted-foreground mt-1 text-right">
            {refundText}
          </span>
        )}
      </div>
    </div>
  )
}
