'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function BookingQrModal({ qrUrl, bookingId }: { qrUrl: string, bookingId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="bg-white p-2 rounded-md border shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
          <img 
            src={`${qrUrl}&size=100x100`} 
            alt="Check-in QR" 
            className="w-20 h-20"
          />
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md w-[90vw] max-w-[90vw] p-6 rounded-xl flex flex-col items-center justify-center border shadow-lg bg-white">
        <DialogHeader className="text-center w-full">
          <DialogTitle className="text-xl sm:text-2xl">Guest Check-in QR</DialogTitle>
          <DialogDescription className="text-center">
            Let the guest scan this QR code using their device to confirm check-in and release your funds.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-white p-4 rounded-xl shadow-sm border mt-4">
          <img 
            src={`${qrUrl}&size=400x400`} 
            alt="Check-in QR Large" 
            className="w-64 h-64 sm:w-80 sm:h-80 object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
