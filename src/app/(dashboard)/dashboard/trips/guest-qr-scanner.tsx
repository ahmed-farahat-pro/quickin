'use client'

import { useEffect, useState, useRef } from 'react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { QrCode, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface GuestQrScannerProps {
  bookingId: string
  onConfirmSuccess?: () => void
}

export function GuestQrScanner({ bookingId, onConfirmSuccess }: GuestQrScannerProps) {
  const t = useTranslations('dashboardTrips.actions')
  const [open, setOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const router = useRouter()

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (open) {
      // Delay initialization slightly to allow Radix UI Dialog to mount the #reader div into the DOM
      timer = setTimeout(() => {
        const readerElement = document.getElementById('reader')
        if (!readerElement) return

        try {
          const scanner = new Html5QrcodeScanner(
            "reader",
            { 
              fps: 10, 
              qrbox: { width: 250, height: 250 },
              supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
            },
            false
          )
          
          scannerRef.current = scanner

          scanner.render(
            async (decodedText) => {
              // If the QR contains the booking ID, or matches quickin://confirm-checkin/[id] or URL format
              if (decodedText.includes(bookingId)) {
                scanner.clear()
                setOpen(false)
                handleConfirmCheckIn()
              } else {
                toast.error("Invalid QR Code for this booking")
              }
            },
            (error) => {
              // parse errors are normal (when no qr is in frame)
            }
          )
        } catch (err) {
          console.error("Scanner init error:", err)
        }
      }, 100)
    }

    return () => {
      clearTimeout(timer)
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
        scannerRef.current = null
      }
    }
  }, [open, bookingId])

  const handleConfirmCheckIn = async () => {
    setIsConfirming(true)
    const supabase = createClient()

    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          is_check_in_confirmed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

      if (updateError) throw updateError

      toast.success('Check-in confirmed! The platform will now release funds to the host.')
      if (onConfirmSuccess) onConfirmSuccess()
      router.refresh()
    } catch (error: any) {
      console.error('Error confirming check-in:', error)
      toast.error('Failed to confirm check-in via QR scan. Please try again.')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline"
            size="sm"
            className="w-full mt-2 gap-2 text-primary border-primary hover:bg-primary/5"
            disabled={isConfirming}
          >
            {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            Scan QR
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Host's QR Code</DialogTitle>
            <DialogDescription>
              Point your camera at the QR code displayed on the host's device to automatically confirm your check-in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-4">
            <div id="reader" className="w-full max-w-[300px] overflow-hidden rounded-lg border border-border min-h-[300px] flex items-center justify-center bg-muted/20">
              {!open && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

