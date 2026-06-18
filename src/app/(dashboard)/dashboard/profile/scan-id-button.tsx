'use client'

import { useState } from 'react'
import { ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EgyptianIDScanner } from '@/components/features/verification/EgyptianIDScanner'
import { toast } from 'sonner'

/**
 * A client-side "Scan National ID" button that opens the EgyptianIDScanner
 * inside a dialog. When the scanner detects an ID number it is displayed via
 * a toast and the dialog closes automatically.
 *
 * This is a thin client wrapper so the parent profile page can remain a
 * server component.
 */
export function ScanIDButton() {
  const [open, setOpen] = useState(false)

  function handleIdDetected(idNumber: string) {
    toast.success(`ID scanned: ${idNumber}`, {
      description: 'Your national ID number has been detected.',
      duration: 8000,
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-[#5B0F16] text-[#5B0F16] hover:bg-[#5B0F16]/5"
          type="button"
        >
          <ScanLine className="h-4 w-4" />
          Scan National ID
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-[32px]">
        <DialogHeader>
          <DialogTitle className="text-[#5B0F16]">Scan Egyptian National ID</DialogTitle>
          <DialogDescription>
            Upload a photo of the front of your national ID card. The number will be
            detected automatically.
          </DialogDescription>
        </DialogHeader>
        <EgyptianIDScanner
          onIdDetected={handleIdDetected}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
