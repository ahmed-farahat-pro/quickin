'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Ban, AlertCircle, Info, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { unpublishListing } from '@/lib/actions/listing-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface UnpublishDialogProps {
  listingId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  activeBookingCount: number
  isAdmin?: boolean
}

export function UnpublishDialog({
  listingId,
  isOpen,
  onOpenChange,
  activeBookingCount,
  isAdmin = false,
}: UnpublishDialogProps) {
  const t = useTranslations('dashboardListings.unpublishDialog')
  const tActions = useTranslations('dashboardListings.actions')
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const hasBookings = activeBookingCount > 0

  const handleUnpublish = async () => {
    setIsPending(true)
    try {
      const result = await unpublishListing(listingId)
      if (result.success) {
        toast.success(tActions('unpublishSuccess'))
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error || tActions('unpublishError'))
      }
    } catch (_error) {
      toast.error(tActions('unpublishError'))
    } finally {
      setIsPending(false)
    }
  }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2 text-destructive">
            {hasBookings ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <Ban className="h-5 w-5" />
            )}
            <DialogTitle>{hasBookings ? t('blockedTitle') : t('title')}</DialogTitle>
          </div>
          <DialogDescription>
            {hasBookings ? (
              <div className="space-y-4">
                <p className="text-foreground font-medium">{t('blockedDescription')}</p>
                {isAdmin && (
                  <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-blue-900 text-sm">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>{t('adminGuidance')}</p>
                  </div>
                )}
              </div>
            ) : (
              t('description')
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('cancel')}
          </Button>
          {!hasBookings && (
            <Button
              variant="destructive"
              onClick={handleUnpublish}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('confirm')}
            </Button>
          )}

        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
